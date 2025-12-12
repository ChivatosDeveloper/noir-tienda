-- ===============================================
-- SUPABASE SQL PARA MODAS ECLIPSE
-- ===============================================

-- 1. Crear tabla de apartados
CREATE TABLE IF NOT EXISTS apartados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo_recogida VARCHAR(6) NOT NULL UNIQUE,
  
  -- Datos del cliente
  cliente_nombre VARCHAR(255) NOT NULL,
  cliente_email VARCHAR(255) NOT NULL,
  cliente_telefono VARCHAR(20) NOT NULL,
  
  -- Datos del producto
  producto_id INTEGER NOT NULL,
  producto_nombre VARCHAR(255) NOT NULL,
  producto_precio DECIMAL(10, 2) NOT NULL,
  producto_color VARCHAR(100),
  producto_tamaño VARCHAR(10),
  producto_imagen TEXT,
  
  -- Fechas y estados
  fecha_apartado TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  fecha_expiracion TIMESTAMP WITH TIME ZONE NOT NULL,
  fecha_validacion TIMESTAMP WITH TIME ZONE,
  fecha_recogida TIMESTAMP WITH TIME ZONE,
  
  -- Estados: 'activo', 'validado', 'recogido', 'expirado', 'cancelado'
  estado VARCHAR(20) NOT NULL DEFAULT 'activo',
  
  -- Validación
  validado_por UUID,
  notas TEXT,
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT estado_check CHECK (estado IN ('activo', 'validado', 'recogido', 'expirado', 'cancelado'))
);

-- 2. Crear tabla de usuarios administradores
CREATE TABLE IF NOT EXISTS usuarios_admin (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL UNIQUE,
  nombre VARCHAR(255) NOT NULL,
  rol VARCHAR(50) NOT NULL DEFAULT 'encargado',
  contraseña_hash VARCHAR(255),
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT rol_check CHECK (rol IN ('encargado', 'admin', 'gerente'))
);

-- 3. Crear tabla de auditoría
CREATE TABLE IF NOT EXISTS auditoria_apartados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  apartado_id UUID NOT NULL REFERENCES apartados(id) ON DELETE CASCADE,
  usuario_id UUID REFERENCES usuarios_admin(id) ON DELETE SET NULL,
  accion VARCHAR(50) NOT NULL,
  detalles JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Crear índices para mejor rendimiento
CREATE INDEX idx_apartados_codigo ON apartados(codigo_recogida);
CREATE INDEX idx_apartados_estado ON apartados(estado);
CREATE INDEX idx_apartados_cliente_email ON apartados(cliente_email);
CREATE INDEX idx_apartados_fecha_expiracion ON apartados(fecha_expiracion);
CREATE INDEX idx_apartados_created ON apartados(created_at DESC);
CREATE INDEX idx_usuarios_admin_email ON usuarios_admin(email);

-- 5. Habilitar RLS (Row Level Security)
ALTER TABLE apartados ENABLE ROW LEVEL SECURITY;
ALTER TABLE usuarios_admin ENABLE ROW LEVEL SECURITY;
ALTER TABLE auditoria_apartados ENABLE ROW LEVEL SECURITY;

-- 6. Crear políticas RLS para apartados
-- Permitir que los admin vean todos los apartados
CREATE POLICY "admin_can_view_all_apartados" ON apartados
  FOR SELECT
  USING (auth.uid() IN (SELECT id FROM usuarios_admin WHERE activo = true));

-- Permitir que admin actualice apartados
CREATE POLICY "admin_can_update_apartados" ON apartados
  FOR UPDATE
  USING (auth.uid() IN (SELECT id FROM usuarios_admin WHERE activo = true));

-- Permitir que clientes vean sus propios apartados
CREATE POLICY "clients_can_view_own_apartados" ON apartados
  FOR SELECT
  USING (cliente_email = auth.jwt() ->> 'email' OR auth.jwt() ->> 'email' IS NULL);

-- 7. Crear políticas RLS para usuarios admin
-- Solo admins pueden ver otros admins
CREATE POLICY "only_admin_can_view_usuarios" ON usuarios_admin
  FOR SELECT
  USING (auth.uid() IN (SELECT id FROM usuarios_admin WHERE rol = 'admin'));

-- 8. Función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- 9. Triggers para actualizar updated_at
CREATE TRIGGER update_apartados_updated_at BEFORE UPDATE ON apartados
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_usuarios_admin_updated_at BEFORE UPDATE ON usuarios_admin
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 10. Función para registrar auditoría
CREATE OR REPLACE FUNCTION log_auditoria()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO auditoria_apartados (apartado_id, accion, detalles)
  VALUES (NEW.id, 'estado_cambio', jsonb_build_object(
    'estado_anterior', OLD.estado,
    'estado_nuevo', NEW.estado,
    'validado_por', NEW.validado_por
  ));
  RETURN NEW;
END;
$$ language 'plpgsql';

-- 11. Trigger para registrar cambios de estado
CREATE TRIGGER audit_apartado_status AFTER UPDATE ON apartados
  FOR EACH ROW
  WHEN (OLD.estado IS DISTINCT FROM NEW.estado)
  EXECUTE FUNCTION log_auditoria();

-- 12. Insertar usuario admin de ejemplo (modificar según sea necesario)
-- Nota: En producción, usar Auth de Supabase
INSERT INTO usuarios_admin (email, nombre, rol, activo)
VALUES ('jefa@modaseclipse.com', 'Jefa de Tienda', 'encargado', true)
ON CONFLICT (email) DO NOTHING;

-- ===============================================
-- VISTAS ÚTILES PARA LA APLICACIÓN
-- ===============================================

-- Vista: Apartados pendientes hoy
CREATE OR REPLACE VIEW apartados_pendientes_hoy AS
SELECT 
  id,
  codigo_recogida,
  cliente_nombre,
  cliente_email,
  cliente_telefono,
  producto_nombre,
  producto_precio,
  producto_color,
  estado,
  fecha_expiracion,
  EXTRACT(EPOCH FROM (fecha_expiracion - NOW())) / 3600 as horas_restantes
FROM apartados
WHERE estado IN ('activo', 'validado')
  AND DATE(fecha_apartado) = CURRENT_DATE
ORDER BY fecha_expiracion ASC;

-- Vista: Apartados por validar
CREATE OR REPLACE VIEW apartados_sin_validar AS
SELECT 
  id,
  codigo_recogida,
  cliente_nombre,
  cliente_email,
  cliente_telefono,
  producto_nombre,
  producto_precio,
  estado,
  fecha_apartado,
  EXTRACT(EPOCH FROM (fecha_expiracion - NOW())) / 3600 as horas_restantes
FROM apartados
WHERE estado = 'activo'
ORDER BY fecha_apartado ASC;

-- Vista: Estadísticas diarias
CREATE OR REPLACE VIEW estadisticas_diarias AS
SELECT 
  DATE(fecha_apartado) as fecha,
  COUNT(*) as total_apartados,
  COUNT(CASE WHEN estado = 'validado' THEN 1 END) as validados,
  COUNT(CASE WHEN estado = 'recogido' THEN 1 END) as recogidos,
  COUNT(CASE WHEN estado = 'activo' THEN 1 END) as pendientes,
  COUNT(CASE WHEN estado = 'expirado' THEN 1 END) as expirados,
  SUM(producto_precio) as ingreso_total
FROM apartados
GROUP BY DATE(fecha_apartado)
ORDER BY fecha DESC;

-- ===============================================
-- PROCEDIMIENTOS ALMACENADOS ÚTILES
-- ===============================================

-- Procedimiento: Validar apartado
CREATE OR REPLACE FUNCTION validar_apartado(
  p_apartado_id UUID,
  p_usuario_id UUID
)
RETURNS TABLE(exito BOOLEAN, mensaje TEXT) AS $$
BEGIN
  UPDATE apartados
  SET 
    estado = 'validado',
    fecha_validacion = NOW(),
    validado_por = p_usuario_id
  WHERE id = p_apartado_id AND estado = 'activo';
  
  RETURN QUERY SELECT true, 'Apartado validado correctamente'::TEXT;
EXCEPTION WHEN OTHERS THEN
  RETURN QUERY SELECT false, SQLERRM::TEXT;
END;
$$ LANGUAGE plpgsql;

-- Procedimiento: Registrar recogida
CREATE OR REPLACE FUNCTION registrar_recogida(
  p_apartado_id UUID,
  p_codigo_recogida VARCHAR
)
RETURNS TABLE(exito BOOLEAN, mensaje TEXT) AS $$
DECLARE
  v_estado VARCHAR;
BEGIN
  SELECT estado INTO v_estado FROM apartados WHERE id = p_apartado_id;
  
  IF v_estado NOT IN ('validado', 'activo') THEN
    RETURN QUERY SELECT false, 'El apartado no está listo para recoger'::TEXT;
    RETURN;
  END IF;
  
  UPDATE apartados
  SET 
    estado = 'recogido',
    fecha_recogida = NOW()
  WHERE id = p_apartado_id AND codigo_recogida = p_codigo_recogida;
  
  RETURN QUERY SELECT true, 'Producto recogido correctamente'::TEXT;
EXCEPTION WHEN OTHERS THEN
  RETURN QUERY SELECT false, SQLERRM::TEXT;
END;
$$ LANGUAGE plpgsql;

-- Procedimiento: Expirar apartados vencidos
CREATE OR REPLACE FUNCTION expirar_apartados_vencidos()
RETURNS TABLE(cantidad_expirada INTEGER) AS $$
BEGIN
  UPDATE apartados
  SET estado = 'expirado'
  WHERE estado = 'activo' AND fecha_expiracion < NOW();
  
  RETURN QUERY SELECT COUNT(*) FROM apartados WHERE estado = 'expirado' AND fecha_expiracion < NOW();
EXCEPTION WHEN OTHERS THEN
  RETURN QUERY SELECT 0;
END;
$$ LANGUAGE plpgsql;
