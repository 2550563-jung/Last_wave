import http from "node:http";

// Stands in for lw_validate_realtime_connection_v1 so the local Worker never
// contacts the production database. Port matches --var SUPABASE_URL in the CI.
const port=Number(process.env.MOCK_SUPABASE_PORT||54399);
http.createServer((request,response)=>{
  request.resume();
  request.on("end",()=>{
    response.setHeader("Content-Type","application/json");
    response.end(JSON.stringify([{valid:true,spectator:false,is_host:true}]));
  });
}).listen(port,"127.0.0.1",()=>console.log(`Mock Supabase on ${port}`));
