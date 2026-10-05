import { ActionButton } from '../../../components/ActionButton'
export function NumberPad({ onDigit, onDelete, onDone, doneLabel='완료' }: { onDigit: (digit: string) => void; onDelete: () => void; onDone: () => void; doneLabel?:string }) {
  return <div className="grid w-[432px] grid-cols-3 gap-[12px]">{['1','2','3','4','5','6','7','8','9','←','0',doneLabel].map(key => <ActionButton key={key} variant="secondary" height={80} className="w-full" aria-label={key === '←' ? '마지막 숫자 삭제' : undefined} onClick={() => key === '←' ? onDelete() : key === doneLabel ? onDone() : onDigit(key)}>{key}</ActionButton>)}</div>
}
