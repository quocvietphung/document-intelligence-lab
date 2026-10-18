import {serveResearchReferences} from '@/lib/private-research-references';
export const runtime='nodejs';
export async function GET(request:Request){return serveResearchReferences(request);}
