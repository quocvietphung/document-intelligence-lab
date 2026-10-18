import {serveResearchReferences} from '@/lib/private-research-references';
export const runtime='nodejs';
/** Compatibility route; general documents are never included in this alias. */
export async function GET(request:Request){return serveResearchReferences(request,'insurance');}
