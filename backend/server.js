// backend/server.js
require('dotenv').config();
const express = require('express');
const nodemailer = require('nodemailer');
const cors = require('cors');
const cron = require('node-cron');
const { createClient } = require('@supabase/supabase-js');
const QRCode = require('qrcode');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// ========== CONFIGURACIÓN SUPABASE ==========
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ADMIN_KEY || process.env.SUPABASE_KEY
);

// Verificar conexión Supabase
supabase.from('apartados').select('count', { count: 'exact' })
  .then(({ count, error }) => {
    if (error) {
      console.log('⚠️  Error al conectar Supabase:', error.message);
    } else {
      console.log('✅ Supabase conectado correctamente');
    }
  })
  .catch(err => console.log('⚠️  Supabase no disponible:', err.message));

// Configuración de email
const transporter = nodemailer.createTransport({
  service: process.env.EMAIL_SERVICE || 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// Verificar conexión de email al iniciar
transporter.verify((error, success) => {
  if (error) {
    console.log('❌ Error en configuración de email:', error);
  } else {
    console.log('✅ Email configurado correctamente');
  }
});

// ENDPOINTS

// 1. Crear apartado
app.post('/api/apartados', async (req, res) => {
  try {
    const { producto, cliente } = req.body;
    
    if (!producto || !cliente || !cliente.nombre || !cliente.email || !cliente.telefono) {
      return res.status(400).json({ 
        error: 'Faltan datos requeridos' 
      });
    }

    const codigoRecogida = generarCodigo();
    const fechaExpiracion = new Date(Date.now() + 24 * 60 * 60 * 1000);

    // ========== GUARDAR EN SUPABASE ==========
    const { data, error } = await supabase
      .from('apartados')
      .insert([{
        codigo_recogida: codigoRecogida,
        cliente_nombre: cliente.nombre,
        cliente_email: cliente.email,
        cliente_telefono: cliente.telefono,
        producto_id: producto.id,
        producto_nombre: producto.nombre,
        producto_precio: producto.precio,
        producto_color: producto.color || '',
        producto_imagen: producto.imagen || '',
        fecha_expiracion: fechaExpiracion.toISOString(),
        estado: 'activo'
      }])
      .select();

    if (error) {
      console.error('Error Supabase:', error);
      return res.status(500).json({
        error: 'Error al guardar en base de datos',
        detalles: error.message
      });
    }

    const apartado = {
      ...data[0],
      producto,
      cliente
    };

    await enviarEmailConfirmacion(apartado);

    res.status(201).json({
      success: true,
      apartado: {
        id: data[0].id,
        codigoRecogida: data[0].codigo_recogida,
        estado: data[0].estado
      },
      mensaje: 'Apartado realizado con éxito. Revisa tu email.'
    });

  } catch (error) {
    console.error('Error al crear apartado:', error);
    res.status(500).json({ 
      error: 'Error al procesar el apartado',
      detalles: error.message 
    });
  }
});

// 2. Obtener apartados de un cliente
app.get('/api/apartados/:email', async (req, res) => {
  try {
    const { email } = req.params;

    // ========== CONSULTAR DESDE SUPABASE ==========
    const { data, error } = await supabase
      .from('apartados')
      .select('*')
      .eq('cliente_email', email)
      .eq('estado', 'activo')
      .order('fecha_apartado', { ascending: false });

    if (error) {
      return res.status(500).json({ error: 'Error al obtener apartados' });
    }

    res.json({
      success: true,
      apartados: data || []
    });
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener apartados' });
  }
});

// 3. Obtener todos los apartados (para admin)
app.get('/api/apartados', async (req, res) => {
  try {
    // ========== CONSULTAR DESDE SUPABASE ==========
    const { data, error } = await supabase
      .from('apartados')
      .select('*')
      .order('fecha_apartado', { ascending: false });

    if (error) {
      return res.status(500).json({ error: 'Error al obtener apartados' });
    }

    res.json({
      success: true,
      total: data.length,
      apartados: data || []
    });
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener apartados' });
  }
});

// 4. Confirmar recogida
app.post('/api/apartados/:id/recoger', async (req, res) => {
  try {
    const { id } = req.params;
    const { codigo } = req.body;

    // ========== OBTENER APARTADO DE SUPABASE ==========
    const { data: apartado, error: getError } = await supabase
      .from('apartados')
      .select('*')
      .eq('id', id)
      .single();

    if (getError || !apartado) {
      return res.status(404).json({ error: 'Apartado no encontrado' });
    }

    if (apartado.estado !== 'activo' && apartado.estado !== 'validado') {
      return res.status(400).json({ error: 'Apartado ya procesado' });
    }

    if (apartado.codigo_recogida !== codigo) {
      return res.status(400).json({ error: 'Código inválido' });
    }

    // ========== ACTUALIZAR EN SUPABASE ==========
    const { data: updated, error: updateError } = await supabase
      .from('apartados')
      .update({
        estado: 'recogido',
        fecha_recogida: new Date().toISOString()
      })
      .eq('id', id)
      .select();

    if (updateError) {
      return res.status(500).json({ error: 'Error al procesar' });
    }

    await enviarEmailRecogida(updated[0]);

    res.json({
      success: true,
      mensaje: 'Producto recogido con éxito',
      apartado: updated[0]
    });

  } catch (error) {
    res.status(500).json({ error: 'Error al confirmar recogida' });
  }
});

// 5. Cancelar apartado
app.delete('/api/apartados/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // ========== OBTENER APARTADO ==========
    const { data: apartado, error: getError } = await supabase
      .from('apartados')
      .select('*')
      .eq('id', id)
      .single();

    if (getError || !apartado) {
      return res.status(404).json({ error: 'Apartado no encontrado' });
    }

    // ========== ACTUALIZAR EN SUPABASE ==========
    const { error: updateError } = await supabase
      .from('apartados')
      .update({ estado: 'cancelado' })
      .eq('id', id);

    if (updateError) {
      return res.status(500).json({ error: 'Error al cancelar' });
    }

    await enviarEmailCancelacion(apartado);

    res.json({
      success: true,
      mensaje: 'Apartado cancelado'
    });

  } catch (error) {
    res.status(500).json({ error: 'Error al cancelar apartado' });
  }
});

// FUNCIONES AUXILIARES

function generarCodigo() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

async function enviarEmailConfirmacion(apartado) {
  // Generar QR Code como Buffer
  const qrBuffer = await QRCode.toBuffer(apartado.codigo_recogida || apartado.codigoRecogida, {
    width: 300,
    margin: 2,
    color: {
      dark: '#000000',
      light: '#FFFFFF'
    }
  });

  const htmlEmail = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; background-color: #f4f4f4; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 40px auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
        .header { background: black; color: white; padding: 30px; text-align: center; }
        .header h1 { margin: 0; font-size: 32px; }
        .content { padding: 30px; }
        .producto { background: #f9f9f9; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .codigo { background: black; color: white; padding: 15px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 4px; border-radius: 8px; margin: 20px 0; }
        .qr-container { text-align: center; margin: 30px 0; }
        .qr-container img { border: 4px solid #000; border-radius: 12px; padding: 15px; background: white; max-width: 300px; }
        .info { background: #fff3cd; padding: 15px; border-left: 4px solid #ffc107; margin: 20px 0; }
        .footer { background: #f4f4f4; padding: 20px; text-align: center; font-size: 12px; color: #666; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>👑 MODAS ECLIPSE</h1>
          <p>Apartado Confirmado</p>
        </div>
        
        <div class="content">
          <h2>¡Hola ${apartado.cliente_nombre || apartado.cliente.nombre}!</h2>
          <p>Tu prenda ha sido apartada con éxito.</p>
          
          <div class="producto">
            <h3>${apartado.producto_nombre || apartado.producto.nombre}</h3>
            <p><strong>Precio:</strong> €${apartado.producto_precio || apartado.producto.precio}</p>
            <p><strong>Color:</strong> ${apartado.producto_color || apartado.producto.color}</p>
          </div>

          <p><strong>Tu código de recogida:</strong></p>
          <div class="codigo">${apartado.codigo_recogida || apartado.codigoRecogida}</div>

          <div class="qr-container">
            <p><strong>📱 Escanea este código QR en tienda:</strong></p>
            <img src="cid:qrcode" alt="Código QR" />
          </div>

          <div class="info">
            <p><strong>⏰ IMPORTANTE:</strong></p>
            <p>Tienes hasta el <strong>${new Date(apartado.fecha_expiracion || apartado.fechaExpiracion).toLocaleString('es-ES')}</strong> para recoger tu prenda.</p>
            <p>Presenta este código QR o el código alfanumérico al momento de recoger.</p>
          </div>

          <p><strong>Dirección:</strong><br>
          Calle Ejemplo 123, Madrid<br>
          Horario: L-S 10:00 - 21:00</p>
        </div>

        <div class="footer">
          <p>Email automático de Modas Eclipse</p>
          <p>Dudas: +34 900 000 000</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const mailOptions = {
    from: `\"Modas Eclipse\" <${process.env.EMAIL_USER}>`,
    to: apartado.cliente_email || apartado.cliente.email,
    subject: `👑 Apartado Confirmado - ${apartado.producto_nombre || apartado.producto.nombre}`,
    html: htmlEmail,
    attachments: [
      {
        filename: 'codigo-qr.png',
        content: qrBuffer,
        cid: 'qrcode' // mismo que en el src="cid:qrcode"
      }
    ]
  };

  await transporter.sendMail(mailOptions);
  console.log(`✅ Email con QR enviado a ${apartado.cliente_email || apartado.cliente.email}`);
}
async function enviarEmailRecogida(apartado) {
  const mailOptions = {
    from: `\"Modas Eclipse\" <${process.env.EMAIL_USER}>`,
    to: apartado.cliente_email,
    subject: '✅ Producto Recogido - Modas Eclipse',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
        <div style="background: black; color: white; padding: 30px; text-align: center;">
          <h1>👑 MODAS ECLIPSE</h1>
        </div>
        <div style="padding: 30px;">
          <h2>¡Gracias por tu visita!</h2>
          <p>Has recogido: <strong>${apartado.producto_nombre}</strong></p>
          <p>Esperamos verte pronto en nuestra tienda.</p>
        </div>
      </div>
    `
  };

  await transporter.sendMail(mailOptions);
}

async function enviarEmailCancelacion(apartado) {
  const mailOptions = {
    from: `\"Modas Eclipse\" <${process.env.EMAIL_USER}>`,
    to: apartado.cliente_email,
    subject: '❌ Apartado Cancelado - Modas Eclipse',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Apartado Cancelado</h2>
        <p>Tu apartado de <strong>${apartado.producto_nombre}</strong> ha sido cancelado.</p>
        <p>La prenda está disponible nuevamente.</p>
      </div>
    `
  };

  await transporter.sendMail(mailOptions);
}

async function enviarEmailExpiracion(apartado) {
  const mailOptions = {
    from: `\"Modas Eclipse\" <${process.env.EMAIL_USER}>`,
    to: apartado.cliente_email,
    subject: '⏰ Apartado Expirado - Modas Eclipse',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Apartado Expirado</h2>
        <p>El plazo para recoger <strong>${apartado.producto_nombre}</strong> ha vencido.</p>
        <p>La prenda está disponible nuevamente en tienda.</p>
      </div>
    `
  };

  await transporter.sendMail(mailOptions);
}

// CRON JOB - Limpiar apartados expirados cada hora
cron.schedule('0 * * * *', async () => {
  console.log('🔄 Verificando apartados expirados...');

  try {
    // ========== CONSULTAR APARTADOS A EXPIRAR ==========
    const { data, error } = await supabase
      .from('apartados')
      .select('*')
      .eq('estado', 'activo')
      .lt('fecha_expiracion', new Date().toISOString());

    if (error) {
      console.error('Error al obtener apartados:', error);
      return;
    }

    // ========== ACTUALIZAR ESTADO A EXPIRADO Y ENVIAR EMAILS ==========
    for (const apartado of data) {
      await supabase
        .from('apartados')
        .update({ estado: 'expirado' })
        .eq('id', apartado.id);

      try {
        await enviarEmailExpiracion(apartado);
        console.log(`❌ Apartado ${apartado.id} expirado`);
      } catch (error) {
        console.error('Error al enviar email de expiración:', error);
      }
    }

    console.log(`✅ ${data.length} apartados expirados`);

  } catch (error) {
    console.error('Error en cron job:', error);
  }
});

// Ruta de prueba
app.get('/', (req, res) => {
  res.json({
    mensaje: '👑 API Modas Eclipse funcionando',
    endpoints: {
      crear: 'POST /api/apartados',
      listar: 'GET /api/apartados',
      porEmail: 'GET /api/apartados/:email',
      recoger: 'POST /api/apartados/:id/recoger',
      cancelar: 'DELETE /api/apartados/:id'
    }
  });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`
  ╔═══════════════════════════════════════╗
  ║  🚀 Servidor Modas Eclipse corriendo ║
  ║  📍 Puerto: ${PORT}                      ║
  ║  🗄️  Base datos: Supabase             ║
  ║  📧 Emails: ${process.env.EMAIL_USER ? 'Configurado' : 'Pendiente'}      ║
  ║  ⏰ Cron: Activo                     ║
  ╚═══════════════════════════════════════╝
  `);
});

module.exports = app;