// Animation quaternions are bounded. The scalar path avoids V8 Math.hypot's
// temporary boxed-argument allocations in these two per-bone hot loops.
// Keep the scaled native algorithm for overflow, underflow and nonfinite input.
export function quaternionLength4(a,b,c,d){
 const sum=a*a+b*b+c*c+d*d;
 if(sum>=1e-200&&sum<=1e200)return Math.sqrt(sum);
 return Math.hypot(a,b,c,d);
}
