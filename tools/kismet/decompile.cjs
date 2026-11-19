// Turns FModel's Kismet bytecode JSON (ReadScriptData on) into readable pseudo code.
// node decompile.cjs <export.json> [FunctionName...]
const fs=require('fs');const [file,...only]=process.argv.slice(2);
const j=JSON.parse(fs.readFileSync(file,'utf8'));
const nm=v=>v?.Property?.Name??v?.Name??(typeof v==='string'?v:JSON.stringify(v));
const fn=f=>typeof f==='string'?f:(f?.ObjectName??'').replace(/^.*'(?:[^:']*:)?([^']*)'$/,'$1');
function e(x){if(x==null)return'∅';const t=x.Token;
 switch(t){
 case'EX_LocalVariable':case'EX_InstanceVariable':case'EX_LocalOutVariable':case'EX_DefaultVariable':return (t==='EX_InstanceVariable'?'this.':'')+nm(x.Variable);
 case'EX_Let':case'EX_LetBool':case'EX_LetObj':case'EX_LetValueOnPersistentFrame':case'EX_LetWeakObjPtr':case'EX_LetDelegate':case'EX_LetMulticastDelegate':return `${e(x.Variable)??nm(x.DestinationProperty)} = ${e(x.Expression??x.AssignmentExpression)}`;
 case'EX_CallMath':case'EX_FinalFunction':case'EX_LocalFinalFunction':case'EX_VirtualFunction':case'EX_LocalVirtualFunction':case'EX_CallMulticastDelegate':return `${fn(x.Function)}(${(x.Parameters||[]).map(e).join(', ')})`;
 case'EX_Context':case'EX_Context_FailSilent':case'EX_ClassContext':return `${e(x.ObjectExpression)}.${e(x.ContextExpression)}`;
 case'EX_DoubleConst':case'EX_FloatConst':case'EX_IntConst':case'EX_ByteConst':case'EX_Int64Const':return String(x.Value);
 case'EX_True':return'true';case'EX_False':return'false';case'EX_Self':return'self';case'EX_NoObject':return'null';case'EX_IntZero':return'0';case'EX_IntOne':return'1';
 case'EX_NameConst':case'EX_StringConst':return JSON.stringify(x.Value);
 case'EX_ObjectConst':return fn(x.Value)||JSON.stringify(x.Value);
 case'EX_VectorConst':return `V(${x.Value.X},${x.Value.Y},${x.Value.Z})`;
 case'EX_StructConst':return `${fn(x.Struct)}{${(x.Properties||x.Value||[]).map(e).join(', ')}}`;
 case'EX_StructMemberContext':return `${e(x.StructExpression)}.${nm(x.Property)}`;
 case'EX_Return':return `return ${e(x.ReturnExpression)}`;
 case'EX_Jump':return `goto ${x.CodeOffset}`;
 case'EX_JumpIfNot':return `if !(${e(x.BooleanExpression)}) goto ${x.CodeOffset}`;
 case'EX_PopExecutionFlow':return'pop flow';case'EX_PopExecutionFlowIfNot':return `if !(${e(x.BooleanExpression)}) pop flow`;
 case'EX_PushExecutionFlow':return `push flow ${x.PushingAddress}`;
 case'EX_ComputedJump':return `goto *${e(x.CodeOffsetExpression)}`;
 case'EX_PrimitiveCast':case'EX_Cast':case'EX_DynamicCast':case'EX_MetaCast':return `cast<${x.ConversionType??fn(x.ClassPtr)}>(${e(x.Target??x.Expression)})`;
 case'EX_EnumConst':case'EX_ByteConst':return String(x.Value);
 case'EX_Nothing':case'EX_EndOfScript':case'EX_Tracepoint':case'EX_WireTracepoint':return null;
 case'EX_SwitchValue':return `switch(${e(x.IndexTerm)}){${(x.Cases||[]).map(c=>e(c.CaseIndexValueTerm)+':'+e(c.CaseTerm)).join('; ')}; default:${e(x.DefaultTerm)}}`;
 case'EX_ArrayConst':return `[${(x.Values||x.Elements||[]).map(e).join(', ')}]`;
 case'EX_InterfaceContext':return e(x.InterfaceValue);
 default:return `<${t} ${JSON.stringify(x).slice(0,160)}>`;}}
for(const o of j){if(o.Type!=='Function'||!o.ScriptBytecode)continue;if(only.length&&!only.includes(o.Name))continue;
 console.log(`\n### ${o.Name}`);for(const s of o.ScriptBytecode){const r=e(s);if(r)console.log(String(s.StatementIndex).padStart(5),' ',r);}}
