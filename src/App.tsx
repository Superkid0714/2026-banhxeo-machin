import { AppRouter } from './app/AppRouter'
import { OrderDraftProvider } from './features/checkout/OrderDraftProvider'
import { AdminPage } from './pages/AdminPage'

export default function App() {
  if (window.location.pathname === '/admin') return <AdminPage />
  return <OrderDraftProvider><AppRouter /></OrderDraftProvider>
}
