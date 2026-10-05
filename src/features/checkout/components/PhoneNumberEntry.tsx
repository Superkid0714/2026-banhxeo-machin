import { ActionButton } from '../../../components/ActionButton'
import { formatPhone } from '../../../domain'
import { useOrderDraft } from '../OrderDraftProvider'
import { NumberPad } from './NumberPad'
export function PhoneNumberEntry({ error, onValidate, onContinue }: { error: boolean; onValidate: () => void; onContinue: () => void }) {
  const { draft, update, phoneValid } = useOrderDraft()
  return <main className="flex flex-1 items-stretch gap-[64px] px-[64px] pt-[36px] pb-[32px]">
    <div className="flex min-w-0 flex-1 flex-col gap-[12px]">
      <p className="text-[13px] font-bold text-muted">2 알림 · 불닭 치즈 반쎄오</p>
      <h1 className="text-[34px] font-bold">문자 받을 번호를 입력해주세요</h1>
      <p className="text-[20px] text-muted">음식이 준비되면 아래 번호로 알려드릴게요.</p>
      <div className={`flex h-[112px] shrink-0 items-center border-b ${error ? 'border-error' : 'border-line'}`}>
        <input aria-label="휴대전화번호" aria-invalid={error} aria-describedby={error ? 'phone-error' : undefined} inputMode="numeric" autoComplete="tel-national" required value={formatPhone(draft.phone)} onChange={event => update({ phone: event.target.value.replace(/\D/g, '').slice(0, 11) })} className="w-full border-0 bg-transparent text-[42px] font-bold leading-[1.25] outline-none" />
      </div>
      {error && <p id="phone-error" className="text-[20px] text-error">휴대전화번호를 다시 확인해주세요.</p>}
      <div className="flex flex-1 flex-col justify-end gap-[12px]"><ActionButton variant="order" className="w-full !text-[22px]" disabled={!phoneValid} onClick={()=>{update({notificationMethod:'sms'});onContinue()}}>이 번호로 문자 받기</ActionButton><p className="text-center text-[13px] text-muted">결제는 주문 후 부스에서 진행됩니다.</p></div>
    </div>
    <div className="flex w-[432px] shrink-0 flex-col items-center justify-center gap-[20px]"><NumberPad onDigit={digit => update({ phone: (draft.phone + digit).slice(0, 11) })} onDelete={() => update({ phone: draft.phone.slice(0, -1) })} onDone={onValidate} /><p className="text-center text-[16px] text-muted">휴대전화번호를 입력해주세요.</p></div>
  </main>
}
