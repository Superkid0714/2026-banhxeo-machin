import { ActionButton } from '../../../components/ActionButton'
import { formatPhone } from '../../../domain'
import { useOrderDraft } from '../OrderDraftProvider'
import { NumberPad } from './NumberPad'
export function PhoneNumberEntry({ error, onValidate, onContinue }: { error: boolean; onValidate: () => void; onContinue: () => void }) {
  const { draft, update, phoneValid } = useOrderDraft()
  return <main className="flex flex-1 items-stretch gap-[64px] px-[64px] pt-[48px] pb-[32px]">
    <div className="flex min-w-0 flex-1 flex-col gap-[28px]">
      <h1 className="text-[34px] font-bold">휴대전화번호를 입력해주세요</h1>
      <p className="text-[20px] text-muted">주문을 위해 휴대전화번호 입력이 필요합니다.</p>
      <div className={`flex h-[128px] shrink-0 items-center border-b-2 ${error ? 'border-error' : 'border-ink'}`}>
        <input aria-label="휴대전화번호" aria-invalid={error} aria-describedby={error ? 'phone-error' : undefined} inputMode="numeric" autoComplete="tel-national" required value={formatPhone(draft.phone)} onChange={event => update({ phone: event.target.value.replace(/\D/g, '').slice(0, 11) })} className="w-full border-0 bg-transparent text-[42px] font-bold leading-[1.25] outline-none" />
      </div>
      {error && <p id="phone-error" className="text-[20px] text-error">휴대전화번호를 다시 확인해주세요.</p>}
      <div className="flex flex-1 flex-col justify-end gap-[16px]"><ActionButton variant="order" className="w-full" disabled={!phoneValid} onClick={onContinue}>이 번호로 계속하기</ActionButton></div>
    </div>
    <div className="flex w-[432px] shrink-0 flex-col items-center justify-center gap-[20px]"><NumberPad onDigit={digit => update({ phone: (draft.phone + digit).slice(0, 11) })} onDelete={() => update({ phone: draft.phone.slice(0, -1) })} onDone={onValidate} /><p className="text-center text-[16px] text-muted">휴대전화번호 11자리를 입력해주세요.</p></div>
  </main>
}
