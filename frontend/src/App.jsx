import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './routes/ProtectedRoute';
import { AppShell } from './layouts/AppShell';
import { LoginPage } from './pages/LoginPage';
import { HomePage } from './pages/HomePage';
import { MorePage } from './pages/MorePage';
import { CustomersPage } from './pages/CustomersPage';
import { CustomerDetailPage } from './pages/CustomerDetailPage';
import { ProductsPage } from './pages/ProductsPage';
import { NewBillPage } from './pages/NewBillPage';
import { DraftsPage } from './pages/DraftsPage';
import { BillsPage } from './pages/BillsPage';
import { InvoiceDetailPage } from './pages/InvoiceDetailPage';
import { MonthlySalesPage } from './pages/MonthlySalesPage';
import { AiAssistantPage } from './pages/AiAssistantPage';

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />

            <Route element={<ProtectedRoute />}>
              <Route element={<AppShell />}>
                <Route path="/" element={<HomePage />} />
                <Route path="/new-bill" element={<NewBillPage />} />
                <Route path="/new-bill/:id" element={<NewBillPage />} />
                <Route path="/bills" element={<BillsPage />} />
                <Route path="/invoices/:id" element={<InvoiceDetailPage />} />
                <Route path="/products" element={<ProductsPage />} />
                <Route path="/customers" element={<CustomersPage />} />
                <Route path="/customers/:id" element={<CustomerDetailPage />} />
                <Route path="/more" element={<MorePage />} />
                <Route path="/ai-assistant" element={<AiAssistantPage />} />
                <Route path="/more/drafts" element={<DraftsPage />} />
                <Route path="/more/monthly-sales" element={<MonthlySalesPage />} />
              </Route>
            </Route>
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
