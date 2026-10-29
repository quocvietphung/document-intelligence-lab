package dev.creditlab.casework;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.*;

/** Bounded body-tree traversal. Never infer a semantic order by sorting the text array. */
final class DoclingStructure {
  record Block(int page,String text,List<String> regions) {}
  record Result(List<String> order,CreditCase.StructureInfo info) {}
  private DoclingStructure() {}

  static Result read(JsonNode source,Map<String,Block> blocks){return read(source,blocks,Map.of());}
  static Result read(JsonNode source,Map<String,Block> blocks,Map<String,List<String>> fragments){
    var body=source.path("body").path("children");
    if(!body.isArray())return unavailable("READING_ORDER_UNAVAILABLE");
    var nodes=new ArrayList<CreditCase.StructureBlock>();var order=new ArrayList<String>();var seen=new HashSet<String>();
    try{
      walkChildren(body,source,blocks,fragments,nodes,order,seen,0);
      var issues=blocks.keySet().stream().anyMatch(k->!order.contains(k))?List.of("READING_ORDER_PARTIAL"):List.<String>of();
      return new Result(List.copyOf(order),new CreditCase.StructureInfo("docling-layout","NOT_INSPECTED",List.copyOf(nodes),issues));
    }catch(IllegalArgumentException error){return unavailable("READING_ORDER_INVALID");}
  }
  private static Result unavailable(String issue){return new Result(List.of(),new CreditCase.StructureInfo("docling-layout","NOT_INSPECTED",List.of(),List.of(issue)));}
  private static void walkChildren(JsonNode children,JsonNode source,Map<String,Block> blocks,Map<String,List<String>> fragments,List<CreditCase.StructureBlock> nodes,List<String> order,Set<String> seen,int depth){
    if(!children.isArray()||children.size()>4000||depth>64)throw new IllegalArgumentException();
    for(var child:children){
      String ref=child.path("$ref").asText();
      if(!ref.matches("#/(groups|texts|tables|pictures|key_value_items|form_items)/[0-9]{1,5}")||!seen.add(ref)||seen.size()>6000)throw new IllegalArgumentException();
      var node=source.at(ref.substring(1));if(!node.isObject())throw new IllegalArgumentException();
      var nested=node.path("children");if(nested.isMissingNode())nested=com.fasterxml.jackson.databind.node.JsonNodeFactory.instance.arrayNode();
      var ids=new ArrayList<String>();nested.forEach(n->ids.add(n.path("$ref").asText()));
      var block=blocks.get(ref);if(block!=null)order.add(ref);
      var parts=fragments.getOrDefault(ref,List.of());ids.addAll(0,parts);
      String kind=node.path("label").asText("unknown");if(kind.length()>80)kind=kind.substring(0,80);
      int level=node.path("level").asInt(0);
      nodes.add(new CreditCase.StructureBlock(ref,kind,block==null?null:block.page(),block==null?List.of():block.regions(),List.copyOf(ids),level>=1&&level<=10?level:null));
      for(String part:parts){var fragment=blocks.get(part);order.add(part);nodes.add(new CreditCase.StructureBlock(part,kind,fragment.page(),fragment.regions(),List.of(),level>=1&&level<=10?level:null));}
      walkChildren(nested,source,blocks,fragments,nodes,order,seen,depth+1);
    }
  }
}
