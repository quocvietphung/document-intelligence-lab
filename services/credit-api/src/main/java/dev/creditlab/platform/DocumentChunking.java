package dev.creditlab.platform;

import java.util.*;
import java.util.function.ToDoubleBiFunction;

/** Page-local experiment strategies. Never combines different originals or page numbers. */
public final class DocumentChunking {
  public enum Strategy { FIXED, RECURSIVE, SEMANTIC, HIERARCHICAL }
  public record Part(String text,int parent) {}
  private static final int SIZE=780,OVERLAP=160;
  private DocumentChunking() {}
  public static List<Part> split(String text,Strategy strategy,ToDoubleBiFunction<String,String> similarity) {
    if(text==null||text.isBlank())return List.of();
    if(strategy==Strategy.FIXED)return windows(text,SIZE,OVERLAP,0);
    if(strategy==Strategy.HIERARCHICAL){
      var out=new ArrayList<Part>();int parent=0;
      for(var section:paragraphs(text,1560))out.addAll(windows(section,SIZE,OVERLAP,++parent));
      return List.copyOf(out);
    }
    var units=paragraphs(text,SIZE);
    var result=new ArrayList<Part>();String current="";
    for(String unit:units) {
      boolean boundary=!current.isEmpty()&&(current.length()+unit.length()+1>SIZE ||
          strategy==Strategy.SEMANTIC&&similarity.applyAsDouble(current,unit)<.55);
      if(boundary){result.add(new Part(current,0));current="";}
      current=current.isEmpty()?unit:current+"\n"+unit;
    }
    if(!current.isEmpty())result.add(new Part(current,0));
    return List.copyOf(result);
  }
  private static List<String> paragraphs(String text,int size) {
    var out=new ArrayList<String>();
    for(String paragraph:text.split("\\n\\s*\\n|(?<=[.!?])\\s+(?=[\\p{Lu}])")) {
      if(paragraph.isBlank())continue;
      if(paragraph.length()<=size){out.add(paragraph.strip());continue;}
      int start=0;
      while(start<paragraph.length()){
        int end=Math.min(start+size,paragraph.length());
        if(end<paragraph.length()){
          int space=paragraph.lastIndexOf(' ',end);
          if(space>start+size/2)end=space;
        }
        out.add(paragraph.substring(start,end).strip());start=end;
      }
    }
    return out;
  }
  private static List<Part> windows(String text,int size,int overlap,int parent){
    var out=new ArrayList<Part>();
    for(int start=0;start<text.length();start+=size-overlap){out.add(new Part(text.substring(start,Math.min(text.length(),start+size)),parent));if(start+size>=text.length())break;}
    return out;
  }
}
