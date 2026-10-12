/** The original-download endpoint deliberately uses octet-stream + nosniff.
 * Only a real raster signature may become an in-page preview, never SVG/HTML.
 */
export function rasterType(bytes:Uint8Array):"image/png"|"image/jpeg"|null {
  const png=[137,80,78,71,13,10,26,10];
  if(bytes.length>=8&&png.every((byte,index)=>bytes[index]===byte))return "image/png";
  if(bytes.length>=3&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255)return "image/jpeg";
  return null;
}
