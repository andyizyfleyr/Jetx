/* eslint-disable @typescript-eslint/no-require-imports */
const {test}=require('node:test');const assert=require('node:assert/strict');const ts=require('typescript');const fs=require('node:fs');const os=require('node:os');const path=require('node:path');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'sky-availability-'));
for(const [name,file] of [['skyjetRisk','lib/treasury/skyjetRisk.ts'],['betLimits','lib/betLimits.ts'],['availability','lib/skyjetAvailability.ts']]){
 let js=ts.transpile(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}).replace('require("./treasury/skyjetRisk")','require("./skyjetRisk.cjs")').replace('require("./betLimits")','require("./betLimits.cjs")');fs.writeFileSync(path.join(dir,name+'.cjs'),js);
}
const {canCoverBets}=require(path.join(dir,'availability.cjs'));fs.rmSync(dir,{recursive:true,force:true});
test('single and grouped buttons respect the same combined available risk',()=>{
 assert.equal(canCoverBets([200],30000,2000,1000,true,1.1),true);
 assert.equal(canCoverBets([2000],30000,2000,1000,true,1.1),false);
 assert.equal(canCoverBets([200,200],30000,2000,1000,true,1.1),false);
 assert.equal(canCoverBets([200,200],30000,4000,1000,true,1.1),true);
 assert.equal(canCoverBets([200],30000,2000,1000,false,2),false);
 assert.equal(canCoverBets([200],100,100000,1000,false,2),false);
 assert.equal(canCoverBets([200],30000,100000,1000,true,10001),false);
});
