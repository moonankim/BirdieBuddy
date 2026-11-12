import paths from '../../design-system/assets/icons.json';

// 장식용 아이콘. 아이콘만 있는 버튼에는 호출부에서 aria-label을 지정한다.
export function Icon({name}:{name:keyof typeof paths}) {
  return <svg className="bb-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d={paths[name]}/></svg>;
}
