require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ADMIN_KEY
);

async function crearAdmin() {
  try {
    // 1. Crear usuario en Auth
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: 'admin@example.com',
      password: 'password123',
      email_confirm: true
    });

    if (authError) {
      console.error('Error creando usuario:', authError.message);
      return;
    }

    // 2. Crear registro en tabla usuarios_admin
    const { data: adminData, error: dbError } = await supabase
      .from('usuarios_admin')
      .insert({
        id: authData.user.id,
        email: authData.user.email,
        nombre: 'Administrador',
        rol: 'admin',
        activo: true
      });

    if (dbError) {
      console.error('Error en BD:', dbError.message);
      return;
    }

    console.log('✅ Admin creado correctamente:', authData.user.email);
  } catch (error) {
    console.error('Error:', error);
  }
}

crearAdmin();