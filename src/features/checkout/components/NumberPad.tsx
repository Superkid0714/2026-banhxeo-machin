import { ActionButton } from '../../../components/ActionButton'
export function NumberPad({ onDigit, onDelete, onDone }: { onDigit: (digit: string) => void; onDelete: () => void; onDone: () => void }) {
  return <div className="grid w-[432px] grid-cols-3 gap-[12px]">{['1','2','3','4','5','6','7','8','9','←','0','완료'].map(key => <ActionButton key={key} variant="secondary" height={80} aria-label={key === '←' ? '마지막 숫자 삭제' : undefined} onClick={() => key === '←' ? onDelete() : key === '완료' ? onDone() : onDigit(key)}>{key}</ActionButton>)}</div>
}
