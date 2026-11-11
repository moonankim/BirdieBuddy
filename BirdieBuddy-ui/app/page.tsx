'use client';
import {useEffect} from 'react';
import {useRouter} from 'next/navigation';
import {homeFor,useSession} from '@/lib/session';
export default function Home() {const s=useSession();const router=useRouter();useEffect(()=>{if(s.status==='signedOut') router.replace('/login'); else if(s.status==='signedIn') router.replace(homeFor(s.user));},[s,router]);return <p>이동 중...</p>;}
