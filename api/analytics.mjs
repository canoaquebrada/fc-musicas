import {json} from "../lib/quack.mjs";
export default async function handler(req,res){
  if(req.method!=="POST")return json(res,405,{error:"Método não permitido"});
  return json(res,200,{ok:true});
}
