"use client";
export function PositionControl({label,position,count,onChange}:{label:string;position:number;count:number;onChange:(position:number)=>void}) {
  return <label className="bw-position">{label}<select value={position} disabled={count<2} onChange={event=>onChange(Number(event.target.value))}>{Array.from({length:count},(_,index)=><option key={index} value={index}>{index+1} of {count}{index===0?" · First":index===count-1?" · Last":""}</option>)}</select></label>;
}
