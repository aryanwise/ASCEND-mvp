'use client';
import React, { useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { waitForSession, isStandalone } from '@/lib/session';
import { FullLoader } from '@/components/ui';

export default function SplashPage() {
  useEffect(() => {
    (async () => {
      // Install-first: if not running as an installed PWA, always show install screen.
      if (!isStandalone()) {
        window.location.href = '/install';
        return;
      }

      const session = await waitForSession();
      if (!session) {
        window.location.href = '/auth';
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('onboarded')
        .eq('id', session.user.id)
        .maybeSingle();

      window.location.href = profile?.onboarded ? '/app' : '/onboard';
    })();
  }, []);

  return <FullLoader />;
}
