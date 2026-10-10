import { useEffect } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { storeRef } from '../lib/referral';

// Visiting /ref/CODE remembers who invited the visitor, then sends them to sign up.
export default function RefCapture() {
  const { code } = useParams();
  useEffect(() => { storeRef(code); }, [code]);
  return <Navigate to="/login" replace />;
}
