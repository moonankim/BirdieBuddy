'use client';
import {useState} from 'react';
export function Avatar({src,name,size="md"}:{src:string|null;name:string;size?:"sm"|"md"}){const [failed,setFailed]=useState<string|null>(null);return <span className={`avatar overflow-hidden ${size==="sm"?"!h-8 !w-8 text-xs":""}`} aria-label={name}>{src&&failed!==src?<img src={src} alt="" className="h-full w-full object-cover" onError={()=>setFailed(src)} />:<span aria-hidden="true">{Array.from(name)[0]??'?'}</span>}</span>;}
