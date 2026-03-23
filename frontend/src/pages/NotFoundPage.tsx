import React from 'react';
import { Link } from 'react-router-dom';
export default function NotFoundPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 text-slate-800">
      <h1 className="text-4xl font-bold text-slate-900 mb-4">404 - Página Não Encontrada</h1>
      <Link
        to="/"
        className="text-blue-600 font-medium hover:text-blue-800 underline transition underline-offset-4"
      >
        Voltar para o Dashboard
      </Link>
    </div>
  );
}
