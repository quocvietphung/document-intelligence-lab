import {describe,it,expect} from "vitest";
import {rasterType} from "./raster-type";
describe("authenticated original raster preview",()=>{
  it("recognizes actual PNG and JPEG signatures independently of download headers",()=>{
    expect(rasterType(new Uint8Array([137,80,78,71,13,10,26,10]))).toBe("image/png");
    expect(rasterType(new Uint8Array([255,216,255,224]))).toBe("image/jpeg");
  });
  it("rejects HTML, SVG, truncated PNG and other file types",()=>{
    for(const text of ["<svg></svg>","<html>image/png</html>","%PDF",""])expect(rasterType(new TextEncoder().encode(text))).toBeNull();
    expect(rasterType(new Uint8Array([137,80,78,71]))).toBeNull();
  });
});
