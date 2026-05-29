import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const json = await request.json();
    const { adminEmail, adminPassword, deleteReason } = json;
    
    const supabaseConfigArgs = {
        supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
        supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    };

    const supabaseServer = await createClient();
    
    // First, check the active authenticated user
    const { data: { user: activeUser } } = await supabaseServer.auth.getUser();
    if (!activeUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: activeProfile } = await supabaseServer
       .from('profiles')
       .select('role')
       .eq('id', activeUser.id)
       .single();

    let adminId = null;

    if (activeProfile?.role === 'admin') {
       // Proceed natively
       adminId = activeUser.id;
    } else {
       // User is NOT an admin. Validate manual credentials if provided
       if (!adminEmail || !adminPassword) {
          return NextResponse.json({ error: 'Admin credentials required to override this action.' }, { status: 403 });
       }

       // IMPORTANT: Use standard Supabase REST or create a purely temporary client to authenticate
       // the overriding user WITHOUT persisting the session to the browser's cookies
       const { createClient: createBrowserClientMock } = await import('@supabase/supabase-js');
       const tempClient = createBrowserClientMock(supabaseConfigArgs.supabaseUrl, supabaseConfigArgs.supabaseKey, {
          auth: { persistSession: false, autoRefreshToken: false }
       });

       const { data: adminAuthData, error: adminAuthError } = await tempClient.auth.signInWithPassword({
          email: adminEmail,
          password: adminPassword
       });

       if (adminAuthError || !adminAuthData.user) {
          return NextResponse.json({ error: 'Invalid admin credentials provided.' }, { status: 403 });
       }

       const { data: adminProfile } = await tempClient
          .from('profiles')
          .select('role')
          .eq('id', adminAuthData.user.id)
          .single();

       if (adminProfile?.role !== 'admin') {
          return NextResponse.json({ error: 'The provided credentials do not belong to an Admin.' }, { status: 403 });
       }

       adminId = adminAuthData.user.id;
    }

    // Now proceed with soft delete
    const { error: updateError } = await supabaseServer
      .from('orders')
      .update({
         status: 'deleted',
         deletedAt: new Date().toISOString(),
         deletedBy: adminId,
         deleteReason: deleteReason || 'Cancelled by admin rules'
      })
      .eq('id', id);

    if (updateError) throw updateError;
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete override error:', error);
    return NextResponse.json({ error: 'Failed to process deletion' }, { status: 500 });
  }
}
