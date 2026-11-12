'use client';
import Link from 'next/link';
import {Guard} from '@/components/chat/shell';
// 샌드박스 자리표시 화면. 라운드 완료 → 발급 결과(연출 방식 미정, docs/design.md)는 현호P 화면(app/(user)/draw/)으로 교체한다.
export default function Draw(){return <Guard role="user"><div className="stack">
  <div><span className="eyebrow">ROUND COMPLETE</span><h1 className="page-title">카드 발급 결과</h1></div>
  <div className="notice stack"><strong>발급 결과 화면 준비 중</strong><p>서버가 확정한 카드·등급·신규 여부와 채팅방 입장 가능 안내를 보여 줄 현호P 화면 자리예요. 뽑기 연출 방식은 아직 정해지지 않았어요.</p></div>
  <Link className="button secondary no-underline" href="/home">홈으로</Link>
</div></Guard>;}
