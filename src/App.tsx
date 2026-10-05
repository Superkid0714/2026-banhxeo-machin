import { AppRouter } from './app/AppRouter'
import { OrderDraftProvider } from './features/checkout/OrderDraftProvider'

export default function App() {
  return <OrderDraftProvider><AppRouter /></OrderDraftProvider>
}
