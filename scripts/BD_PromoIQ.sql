USE [master]
GO

GO

/****** Object:  Database [PromoIQ]    Script Date: 13/10/2026 19:57:37 ******/
CREATE DATABASE [PromoIQ]
 CONTAINMENT = NONE
 ON  PRIMARY 
( NAME = N'PromoIQ', FILENAME = N'C:\Program Files\Microsoft SQL Server\MSSQL15.SQLEXPRESS\MSSQL\DATA\PromoIQ.mdf' , SIZE = 204800KB , MAXSIZE = UNLIMITED, FILEGROWTH = 65536KB )
 LOG ON 
( NAME = N'PromoIQ_log', FILENAME = N'C:\Program Files\Microsoft SQL Server\MSSQL15.SQLEXPRESS\MSSQL\DATA\PromoIQ_log.ldf' , SIZE = 1384448KB , MAXSIZE = 2048GB , FILEGROWTH = 65536KB )
 WITH CATALOG_COLLATION = DATABASE_DEFAULT
GO
ALTER DATABASE [PromoIQ] SET COMPATIBILITY_LEVEL = 150
GO
IF (1 = FULLTEXTSERVICEPROPERTY('IsFullTextInstalled'))
begin
EXEC [PromoIQ].[dbo].[sp_fulltext_database] @action = 'enable'
end
GO
ALTER DATABASE [PromoIQ] SET ANSI_NULL_DEFAULT OFF 
GO
ALTER DATABASE [PromoIQ] SET ANSI_NULLS OFF 
GO
ALTER DATABASE [PromoIQ] SET ANSI_PADDING OFF 
GO
ALTER DATABASE [PromoIQ] SET ANSI_WARNINGS OFF 
GO
ALTER DATABASE [PromoIQ] SET ARITHABORT OFF 
GO
ALTER DATABASE [PromoIQ] SET AUTO_CLOSE ON 
GO
ALTER DATABASE [PromoIQ] SET AUTO_SHRINK OFF 
GO
ALTER DATABASE [PromoIQ] SET AUTO_UPDATE_STATISTICS ON 
GO
ALTER DATABASE [PromoIQ] SET CURSOR_CLOSE_ON_COMMIT OFF 
GO
ALTER DATABASE [PromoIQ] SET CURSOR_DEFAULT  GLOBAL 
GO
ALTER DATABASE [PromoIQ] SET CONCAT_NULL_YIELDS_NULL OFF 
GO
ALTER DATABASE [PromoIQ] SET NUMERIC_ROUNDABORT OFF 
GO
ALTER DATABASE [PromoIQ] SET QUOTED_IDENTIFIER OFF 
GO
ALTER DATABASE [PromoIQ] SET RECURSIVE_TRIGGERS OFF 
GO
ALTER DATABASE [PromoIQ] SET  ENABLE_BROKER 
GO
ALTER DATABASE [PromoIQ] SET AUTO_UPDATE_STATISTICS_ASYNC OFF 
GO
ALTER DATABASE [PromoIQ] SET DATE_CORRELATION_OPTIMIZATION OFF 
GO
ALTER DATABASE [PromoIQ] SET TRUSTWORTHY OFF 
GO
ALTER DATABASE [PromoIQ] SET ALLOW_SNAPSHOT_ISOLATION OFF 
GO
ALTER DATABASE [PromoIQ] SET PARAMETERIZATION SIMPLE 
GO
ALTER DATABASE [PromoIQ] SET READ_COMMITTED_SNAPSHOT OFF 
GO
ALTER DATABASE [PromoIQ] SET HONOR_BROKER_PRIORITY OFF 
GO
ALTER DATABASE [PromoIQ] SET RECOVERY SIMPLE 
GO
ALTER DATABASE [PromoIQ] SET  MULTI_USER 
GO
ALTER DATABASE [PromoIQ] SET PAGE_VERIFY CHECKSUM  
GO
ALTER DATABASE [PromoIQ] SET DB_CHAINING OFF 
GO
ALTER DATABASE [PromoIQ] SET FILESTREAM( NON_TRANSACTED_ACCESS = OFF ) 
GO
ALTER DATABASE [PromoIQ] SET TARGET_RECOVERY_TIME = 60 SECONDS 
GO
ALTER DATABASE [PromoIQ] SET DELAYED_DURABILITY = DISABLED 
GO
ALTER DATABASE [PromoIQ] SET ACCELERATED_DATABASE_RECOVERY = OFF  
GO
ALTER DATABASE [PromoIQ] SET QUERY_STORE = OFF
GO

GO

USE [PromoIQ]
GO

GO

/****** Object:  Table [dbo].[articulos_maestro]    Script Date: 13/10/2026 19:57:37 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[articulos_maestro](
	[id] [int] IDENTITY(1,1) NOT NULL,
	[sku] [nvarchar](50) NULL,
	[descripcion] [nvarchar](300) NULL,
	[codigo_sucursal] [varchar](10) NULL,
	[sucursal] [nvarchar](200) NULL,
	[costo_unitario] [decimal](10, 2) NULL,
	[precio_unitario] [decimal](10, 2) NULL,
	[buyer_max_asr] [nvarchar](100) NULL,
	[vop] [nvarchar](50) NULL,
	[outl] [nvarchar](50) NULL,
	[sys_class] [nvarchar](100) NULL,
	[buyer_class] [nvarchar](100) NULL,
	[categoria_tienda] [nvarchar](200) NULL,
	[unidad_medida] [nvarchar](50) NULL,
	[catalogo] [nvarchar](200) NULL,
	[categoria] [nvarchar](200) NULL,
	[linea] [nvarchar](200) NULL,
	[familia] [nvarchar](200) NULL,
	[departamento] [nvarchar](200) NULL,
	[estado] [nvarchar](50) NULL,
	[marca] [nvarchar](200) NULL,
	[codigo_proveedor] [nvarchar](50) NULL,
	[proveedor] [nvarchar](200) NULL,
	[administrador] [nvarchar](200) NULL,
	[comprador] [nvarchar](200) NULL,
	[bodega_awr] [nvarchar](100) NULL,
	[dc_id] [nvarchar](50) NULL,
	[source_code] [nvarchar](50) NULL,
	[fecha_primer_ingreso] [nvarchar](50) NULL,
	[consumo_mensual] [decimal](10, 2) NULL,
	[existencia_bodega] [decimal](10, 2) NULL,
	[transito] [decimal](10, 2) NULL,
	[fecha_ultimo_ingreso] [nvarchar](50) NULL,
	[disponible] [decimal](10, 2) NULL,
	[minimo_presentacion] [decimal](10, 2) NULL,
	[minimo] [decimal](10, 2) NULL,
	[maximo] [decimal](10, 2) NULL,
	[case_pack] [decimal](10, 2) NULL,
	[hard_max] [decimal](10, 2) NULL,
	[weekly_asr] [decimal](10, 2) NULL,
	[exclusivo] [nvarchar](50) NULL,
	[pais] [nvarchar](5) NULL,
	[fecha_actualizacion] [datetime] NULL,
PRIMARY KEY CLUSTERED 
(
	[id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO

GO

/****** Object:  Table [dbo].[articulos_sucursales]    Script Date: 13/10/2026 19:57:37 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[articulos_sucursales](
	[id] [int] IDENTITY(1,1) NOT NULL,
	[sku] [nvarchar](50) NULL,
	[codigo_sucursal] [nvarchar](20) NULL,
	[sucursal] [nvarchar](200) NULL,
	[existencia] [decimal](10, 2) NULL,
	[disponible] [decimal](10, 2) NULL,
	[consumo_mensual] [decimal](10, 2) NULL,
	[pais] [nvarchar](5) NULL,
	[fecha_actualizacion] [datetime] NULL,
PRIMARY KEY CLUSTERED 
(
	[id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO

GO

/****** Object:  Table [dbo].[auditoria_log]    Script Date: 13/10/2026 19:57:37 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[auditoria_log](
	[id] [int] IDENTITY(1,1) NOT NULL,
	[usuario_id] [int] NOT NULL,
	[usuario_nombre] [nvarchar](200) NULL,
	[accion] [nvarchar](100) NOT NULL,
	[entidad] [nvarchar](100) NOT NULL,
	[entidad_id] [nvarchar](100) NULL,
	[pais] [nvarchar](5) NULL,
	[detalle] [nvarchar](500) NULL,
	[fecha] [datetime] NULL,
PRIMARY KEY CLUSTERED 
(
	[id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO

GO

/****** Object:  Table [dbo].[carga_log]    Script Date: 13/10/2026 19:57:37 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[carga_log](
	[id] [int] IDENTITY(1,1) NOT NULL,
	[usuario_id] [int] NULL,
	[nombre_archivo] [nvarchar](200) NULL,
	[registros_cargados] [int] NULL,
	[dinamica_id] [int] NULL,
	[fecha] [datetime] NULL,
PRIMARY KEY CLUSTERED 
(
	[id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO

GO

/****** Object:  Table [dbo].[cat_categorias]    Script Date: 13/10/2026 19:57:37 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[cat_categorias](
	[id] [int] IDENTITY(1,1) NOT NULL,
	[codigo] [nvarchar](50) NULL,
	[nombre] [nvarchar](100) NOT NULL,
	[descripcion] [nvarchar](300) NULL,
	[categoria_padre_id] [int] NULL,
PRIMARY KEY CLUSTERED 
(
	[id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO

GO

/****** Object:  Table [dbo].[cat_paises]    Script Date: 13/10/2026 19:57:37 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[cat_paises](
	[codigo] [nvarchar](5) NOT NULL,
	[nombre] [nvarchar](100) NOT NULL,
	[bandera_emoji] [nvarchar](10) NULL,
	[color_primario] [nvarchar](10) NULL,
	[color_secundario] [nvarchar](10) NULL,
	[activo] [bit] NULL,
	[orden] [int] NULL,
	[moneda_simbolo] [nvarchar](5) NULL,
	[moneda_codigo] [nvarchar](5) NULL,
PRIMARY KEY CLUSTERED 
(
	[codigo] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO

GO

/****** Object:  Table [dbo].[cat_roles]    Script Date: 13/10/2026 19:57:37 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[cat_roles](
	[id] [int] IDENTITY(1,1) NOT NULL,
	[codigo] [nvarchar](50) NOT NULL,
	[nombre] [nvarchar](100) NOT NULL,
	[descripcion] [nvarchar](300) NULL,
PRIMARY KEY CLUSTERED 
(
	[id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY],
UNIQUE NONCLUSTERED 
(
	[codigo] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO

GO

/****** Object:  Table [dbo].[cat_tiendas]    Script Date: 13/10/2026 19:57:37 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[cat_tiendas](
	[id] [int] IDENTITY(1,1) NOT NULL,
	[codigo] [nvarchar](50) NOT NULL,
	[nombre] [nvarchar](200) NOT NULL,
	[pais] [nvarchar](5) NOT NULL,
	[activo] [bit] NULL,
	[creado_en] [datetime] NULL,
PRIMARY KEY CLUSTERED 
(
	[id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY],
 CONSTRAINT [UQ_tienda_codigo_pais] UNIQUE NONCLUSTERED 
(
	[codigo] ASC,
	[pais] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO

GO

/****** Object:  Table [dbo].[consultas_log]    Script Date: 13/10/2026 19:57:37 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[consultas_log](
	[id] [int] IDENTITY(1,1) NOT NULL,
	[usuario_id] [int] NULL,
	[pregunta] [nvarchar](500) NULL,
	[respuesta] [nvarchar](max) NULL,
	[tokens_usados] [int] NULL,
	[fecha] [datetime] NULL,
	[pais_consultado] [nvarchar](5) NULL,
PRIMARY KEY CLUSTERED 
(
	[id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO

GO

/****** Object:  Table [dbo].[conversacion_mensajes]    Script Date: 13/10/2026 19:57:37 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[conversacion_mensajes](
	[id] [int] IDENTITY(1,1) NOT NULL,
	[conversacion_id] [int] NOT NULL,
	[rol] [nvarchar](20) NOT NULL,
	[contenido] [nvarchar](max) NOT NULL,
	[tokens_usados] [int] NULL,
	[fecha] [datetime] NULL,
PRIMARY KEY CLUSTERED 
(
	[id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO

GO

/****** Object:  Table [dbo].[conversaciones]    Script Date: 13/10/2026 19:57:37 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[conversaciones](
	[id] [int] IDENTITY(1,1) NOT NULL,
	[usuario_id] [int] NOT NULL,
	[titulo] [nvarchar](200) NULL,
	[creado_en] [datetime] NULL,
	[ultimo_mensaje] [datetime] NULL,
	[activa] [bit] NULL,
PRIMARY KEY CLUSTERED 
(
	[id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO

GO

/****** Object:  Table [dbo].[devoluciones]    Script Date: 13/10/2026 19:57:37 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[devoluciones](
	[id] [int] IDENTITY(1,1) NOT NULL,
	[pais] [nvarchar](5) NOT NULL,
	[tienda_codigo] [nvarchar](50) NOT NULL,
	[sku] [nvarchar](50) NOT NULL,
	[descripcion] [nvarchar](300) NULL,
	[cantidad_indicada] [decimal](10, 2) NOT NULL,
	[disponible_inicial] [decimal](10, 2) NULL,
	[existencia_bodega_inicial] [decimal](10, 2) NULL,
	[fecha_registro] [datetime] NULL,
	[usuario_id] [int] NULL,
	[cerrada] [bit] NULL,
	[comentario_cierre] [nvarchar](500) NULL,
	[cerrada_en] [datetime] NULL,
	[cerrada_por] [int] NULL,
	[creado_en] [datetime] NULL,
PRIMARY KEY CLUSTERED 
(
	[id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO

GO

/****** Object:  Table [dbo].[dinamica_detalle]    Script Date: 13/10/2026 19:57:37 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[dinamica_detalle](
	[id] [int] IDENTITY(1,1) NOT NULL,
	[dinamica_id] [int] NOT NULL,
	[sku] [nvarchar](50) NOT NULL,
	[descripcion] [nvarchar](300) NULL,
	[precio_dinamica] [decimal](10, 2) NULL,
	[ubicacion_dinamica] [nvarchar](100) NULL,
	[tienda] [nvarchar](20) NULL,
	[tipo_campana] [nvarchar](100) NULL,
	[activo] [bit] NULL,
	[pais] [nvarchar](5) NULL,
	[porcentaje_descuento] [decimal](5, 2) NULL,
	[ubicacion_tienda] [nvarchar](200) NULL,
	[fecha_actualizacion] [datetime2](6) NULL,
PRIMARY KEY CLUSTERED 
(
	[id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO

GO

/****** Object:  Table [dbo].[dinamicas]    Script Date: 13/10/2026 19:57:37 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[dinamicas](
	[id] [int] IDENTITY(1,1) NOT NULL,
	[nombre] [nvarchar](200) NOT NULL,
	[fecha_inicio] [date] NOT NULL,
	[fecha_fin] [date] NOT NULL,
	[descripcion] [nvarchar](max) NULL,
	[activa] [bit] NULL,
	[creado_por] [int] NULL,
	[creado_en] [datetime] NULL,
	[pais] [nvarchar](5) NULL,
PRIMARY KEY CLUSTERED 
(
	[id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO

GO

/****** Object:  Table [dbo].[layout_tiendas]    Script Date: 13/10/2026 19:57:37 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[layout_tiendas](
	[id] [int] IDENTITY(1,1) NOT NULL,
	[tienda_codigo] [nvarchar](50) NOT NULL,
	[pais] [nvarchar](5) NOT NULL,
	[tipo] [nvarchar](20) NOT NULL,
	[codigo_ubicacion] [nvarchar](50) NULL,
	[descripcion] [nvarchar](500) NULL,
	[activo] [bit] NULL,
	[creado_en] [datetime] NULL,
	[fila] [int] NULL,
	[columna] [int] NULL,
	[fila_fin] [int] NULL,
	[columna_fin] [int] NULL,
PRIMARY KEY CLUSTERED 
(
	[id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO

GO

/****** Object:  Table [dbo].[limites_tokens_pais]    Script Date: 13/10/2026 19:57:37 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[limites_tokens_pais](
	[id] [int] IDENTITY(1,1) NOT NULL,
	[pais] [nvarchar](5) NOT NULL,
	[limite_diario_alerta] [int] NOT NULL,
	[limite_mensual_corte] [int] NOT NULL,
	[activo] [bit] NULL,
	[actualizado_en] [datetime] NULL,
PRIMARY KEY CLUSTERED 
(
	[id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY],
UNIQUE NONCLUSTERED 
(
	[pais] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO

GO

/****** Object:  Table [dbo].[limites_tokens_rol]    Script Date: 13/10/2026 19:57:37 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[limites_tokens_rol](
	[id] [int] IDENTITY(1,1) NOT NULL,
	[pais] [nvarchar](5) NOT NULL,
	[rol] [nvarchar](20) NOT NULL,
	[limite_diario_alerta] [int] NOT NULL,
	[limite_mensual_corte] [int] NOT NULL,
	[activo] [bit] NULL,
	[actualizado_en] [datetime] NULL,
PRIMARY KEY CLUSTERED 
(
	[id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY],
 CONSTRAINT [UQ_limite_pais_rol] UNIQUE NONCLUSTERED 
(
	[pais] ASC,
	[rol] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO

GO

/****** Object:  Table [dbo].[notificacion_vencimiento_log]    Script Date: 13/10/2026 19:57:37 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[notificacion_vencimiento_log](
	[id] [int] IDENTITY(1,1) NOT NULL,
	[dinamica_id] [int] NOT NULL,
	[pais] [nvarchar](5) NOT NULL,
	[fecha_envio] [date] NOT NULL,
	[creado_en] [datetime] NULL,
PRIMARY KEY CLUSTERED 
(
	[id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY],
 CONSTRAINT [UQ_dinamica_fecha] UNIQUE NONCLUSTERED 
(
	[dinamica_id] ASC,
	[fecha_envio] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO

GO

/****** Object:  Table [dbo].[usuario_perfil_ia]    Script Date: 13/10/2026 19:57:37 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[usuario_perfil_ia](
	[id] [int] IDENTITY(1,1) NOT NULL,
	[usuario_id] [int] NOT NULL,
	[articulos_favoritos] [nvarchar](max) NULL,
	[categorias_interes] [nvarchar](max) NULL,
	[resumen_actividad] [nvarchar](max) NULL,
	[total_conversaciones] [int] NULL,
	[ultima_actualizacion] [datetime] NULL,
	[email_notificaciones] [nvarchar](200) NULL,
	[email_confirmado] [bit] NULL,
	[solicitar_email] [bit] NULL,
	[nombre_asistente] [nvarchar](100) NULL,
	[nivel_detalle] [nvarchar](20) NULL,
	[mensaje_bienvenida] [nvarchar](max) NULL,
	[ultima_sesion] [datetime] NULL,
PRIMARY KEY CLUSTERED 
(
	[id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY],
UNIQUE NONCLUSTERED 
(
	[usuario_id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO

GO

/****** Object:  Table [dbo].[usuarios]    Script Date: 13/10/2026 19:57:37 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[usuarios](
	[id] [int] IDENTITY(1,1) NOT NULL,
	[nombre] [nvarchar](100) NOT NULL,
	[email] [nvarchar](100) NOT NULL,
	[password] [nvarchar](255) NOT NULL,
	[rol_id] [int] NOT NULL,
	[tiendas] [nvarchar](20) NULL,
	[activo] [bit] NULL,
	[creado_en] [datetime] NULL,
	[ultimo_acceso] [datetime] NULL,
	[pais] [nvarchar](5) NULL,
	[numero_colaborador] [nvarchar](20) NULL,
	[intentos_fallidos] [int] NOT NULL,
	[bloqueado_hasta] [datetime] NULL,
	[reset_token] [nvarchar](100) NULL,
	[reset_token_expira] [datetime] NULL,
PRIMARY KEY CLUSTERED 
(
	[id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY],
UNIQUE NONCLUSTERED 
(
	[email] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO

GO

/****** Object:  Table [dbo].[ventas_mes]    Script Date: 13/10/2026 19:57:37 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[ventas_mes](
	[id] [int] IDENTITY(1,1) NOT NULL,
	[sku] [nvarchar](50) NOT NULL,
	[descripcion] [nvarchar](300) NULL,
	[venta_express] [decimal](10, 2) NULL,
	[venta_mostrador] [decimal](10, 2) NULL,
	[venta_externo] [decimal](10, 2) NULL,
	[venta_ecommerce] [decimal](10, 2) NULL,
	[venta_total] [decimal](10, 2) NULL,
	[mes] [int] NULL,
	[anio] [int] NULL,
	[pais] [nvarchar](5) NULL,
	[fecha_carga] [datetime] NULL,
PRIMARY KEY CLUSTERED 
(
	[id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO

GO

SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_articulos_categoria]    Script Date: 13/10/2026 19:57:37 ******/
CREATE NONCLUSTERED INDEX [IX_articulos_categoria] ON [dbo].[articulos_maestro]
(
	[categoria] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO

GO

SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_articulos_pais]    Script Date: 13/10/2026 19:57:37 ******/
CREATE NONCLUSTERED INDEX [IX_articulos_pais] ON [dbo].[articulos_maestro]
(
	[pais] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO

GO

SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_articulos_sku]    Script Date: 13/10/2026 19:57:37 ******/
CREATE NONCLUSTERED INDEX [IX_articulos_sku] ON [dbo].[articulos_maestro]
(
	[sku] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO

GO

SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_articulos_sucursal]    Script Date: 13/10/2026 19:57:37 ******/
CREATE NONCLUSTERED INDEX [IX_articulos_sucursal] ON [dbo].[articulos_maestro]
(
	[codigo_sucursal] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO

GO

SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_suc_pais]    Script Date: 13/10/2026 19:57:37 ******/
CREATE NONCLUSTERED INDEX [IX_suc_pais] ON [dbo].[articulos_sucursales]
(
	[pais] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO

GO

SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_suc_sku]    Script Date: 13/10/2026 19:57:37 ******/
CREATE NONCLUSTERED INDEX [IX_suc_sku] ON [dbo].[articulos_sucursales]
(
	[sku] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO

GO

/****** Object:  Index [IX_auditoria_fecha]    Script Date: 13/10/2026 19:57:37 ******/
CREATE NONCLUSTERED INDEX [IX_auditoria_fecha] ON [dbo].[auditoria_log]
(
	[fecha] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO

GO

/****** Object:  Index [IX_auditoria_usuario]    Script Date: 13/10/2026 19:57:37 ******/
CREATE NONCLUSTERED INDEX [IX_auditoria_usuario] ON [dbo].[auditoria_log]
(
	[usuario_id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO

GO

SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_tiendas_pais]    Script Date: 13/10/2026 19:57:37 ******/
CREATE NONCLUSTERED INDEX [IX_tiendas_pais] ON [dbo].[cat_tiendas]
(
	[pais] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO

GO

SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_devoluciones_pais]    Script Date: 13/10/2026 19:57:37 ******/
CREATE NONCLUSTERED INDEX [IX_devoluciones_pais] ON [dbo].[devoluciones]
(
	[pais] ASC,
	[cerrada] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO

GO

SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_devoluciones_sku]    Script Date: 13/10/2026 19:57:37 ******/
CREATE NONCLUSTERED INDEX [IX_devoluciones_sku] ON [dbo].[devoluciones]
(
	[sku] ASC,
	[pais] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO

GO

SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_dinamicas_pais]    Script Date: 13/10/2026 19:57:37 ******/
CREATE NONCLUSTERED INDEX [IX_dinamicas_pais] ON [dbo].[dinamicas]
(
	[pais] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO

GO

SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_layout_codigo]    Script Date: 13/10/2026 19:57:37 ******/
CREATE NONCLUSTERED INDEX [IX_layout_codigo] ON [dbo].[layout_tiendas]
(
	[codigo_ubicacion] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO

GO

SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_layout_tienda]    Script Date: 13/10/2026 19:57:37 ******/
CREATE NONCLUSTERED INDEX [IX_layout_tienda] ON [dbo].[layout_tiendas]
(
	[tienda_codigo] ASC,
	[pais] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO

GO

SET ANSI_PADDING ON
GO
/****** Object:  Index [UQ_colaborador_global]    Script Date: 13/10/2026 19:57:37 ******/
CREATE UNIQUE NONCLUSTERED INDEX [UQ_colaborador_global] ON [dbo].[usuarios]
(
	[numero_colaborador] ASC
)
WHERE ([pais] IS NULL AND [numero_colaborador] IS NOT NULL)
WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, IGNORE_DUP_KEY = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO

GO

SET ANSI_PADDING ON
GO
/****** Object:  Index [UQ_colaborador_pais]    Script Date: 13/10/2026 19:57:37 ******/
CREATE UNIQUE NONCLUSTERED INDEX [UQ_colaborador_pais] ON [dbo].[usuarios]
(
	[numero_colaborador] ASC,
	[pais] ASC
)
WHERE ([pais] IS NOT NULL AND [numero_colaborador] IS NOT NULL)
WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, IGNORE_DUP_KEY = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO

GO

SET ANSI_PADDING ON
GO
/****** Object:  Index [UQ_usuarios_reset_token]    Script Date: 13/10/2026 19:57:37 ******/
CREATE UNIQUE NONCLUSTERED INDEX [UQ_usuarios_reset_token] ON [dbo].[usuarios]
(
	[reset_token] ASC
)
WHERE ([reset_token] IS NOT NULL)
WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, IGNORE_DUP_KEY = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO

GO

/****** Object:  Index [IX_ventas_mes]    Script Date: 13/10/2026 19:57:37 ******/
CREATE NONCLUSTERED INDEX [IX_ventas_mes] ON [dbo].[ventas_mes]
(
	[mes] ASC,
	[anio] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO

GO

SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_ventas_pais]    Script Date: 13/10/2026 19:57:37 ******/
CREATE NONCLUSTERED INDEX [IX_ventas_pais] ON [dbo].[ventas_mes]
(
	[pais] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO

GO

SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_ventas_sku]    Script Date: 13/10/2026 19:57:37 ******/
CREATE NONCLUSTERED INDEX [IX_ventas_sku] ON [dbo].[ventas_mes]
(
	[sku] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO

GO

ALTER TABLE [dbo].[articulos_maestro] ADD  DEFAULT (getdate()) FOR [fecha_actualizacion]
GO

GO

ALTER TABLE [dbo].[articulos_sucursales] ADD  DEFAULT (getdate()) FOR [fecha_actualizacion]
GO

GO

ALTER TABLE [dbo].[auditoria_log] ADD  DEFAULT (getdate()) FOR [fecha]
GO

GO

ALTER TABLE [dbo].[carga_log] ADD  DEFAULT (getdate()) FOR [fecha]
GO

GO

ALTER TABLE [dbo].[cat_paises] ADD  DEFAULT ((1)) FOR [activo]
GO

GO

ALTER TABLE [dbo].[cat_paises] ADD  DEFAULT ((0)) FOR [orden]
GO

GO

ALTER TABLE [dbo].[cat_paises] ADD  CONSTRAINT [DF_cat_paises_moneda_simbolo]  DEFAULT ('$') FOR [moneda_simbolo]
GO

GO

ALTER TABLE [dbo].[cat_paises] ADD  CONSTRAINT [DF_cat_paises_moneda_codigo]  DEFAULT ('USD') FOR [moneda_codigo]
GO

GO

ALTER TABLE [dbo].[cat_tiendas] ADD  DEFAULT ((1)) FOR [activo]
GO

GO

ALTER TABLE [dbo].[cat_tiendas] ADD  DEFAULT (getdate()) FOR [creado_en]
GO

GO

ALTER TABLE [dbo].[consultas_log] ADD  DEFAULT (getdate()) FOR [fecha]
GO

GO

ALTER TABLE [dbo].[conversacion_mensajes] ADD  DEFAULT (getdate()) FOR [fecha]
GO

GO

ALTER TABLE [dbo].[conversaciones] ADD  DEFAULT (getdate()) FOR [creado_en]
GO

GO

ALTER TABLE [dbo].[conversaciones] ADD  DEFAULT (getdate()) FOR [ultimo_mensaje]
GO

GO

ALTER TABLE [dbo].[conversaciones] ADD  DEFAULT ((1)) FOR [activa]
GO

GO

ALTER TABLE [dbo].[devoluciones] ADD  DEFAULT (getdate()) FOR [fecha_registro]
GO

GO

ALTER TABLE [dbo].[devoluciones] ADD  DEFAULT ((0)) FOR [cerrada]
GO

GO

ALTER TABLE [dbo].[devoluciones] ADD  DEFAULT (getdate()) FOR [creado_en]
GO

GO

ALTER TABLE [dbo].[dinamica_detalle] ADD  DEFAULT ((1)) FOR [activo]
GO

GO

ALTER TABLE [dbo].[dinamica_detalle] ADD  DEFAULT (sysutcdatetime()) FOR [fecha_actualizacion]
GO

GO

ALTER TABLE [dbo].[dinamicas] ADD  DEFAULT ((1)) FOR [activa]
GO

GO

ALTER TABLE [dbo].[dinamicas] ADD  DEFAULT (getdate()) FOR [creado_en]
GO

GO

ALTER TABLE [dbo].[layout_tiendas] ADD  DEFAULT ((1)) FOR [activo]
GO

GO

ALTER TABLE [dbo].[layout_tiendas] ADD  DEFAULT (getdate()) FOR [creado_en]
GO

GO

ALTER TABLE [dbo].[limites_tokens_pais] ADD  DEFAULT ((300000)) FOR [limite_diario_alerta]
GO

GO

ALTER TABLE [dbo].[limites_tokens_pais] ADD  DEFAULT ((6000000)) FOR [limite_mensual_corte]
GO

GO

ALTER TABLE [dbo].[limites_tokens_pais] ADD  DEFAULT ((1)) FOR [activo]
GO

GO

ALTER TABLE [dbo].[limites_tokens_pais] ADD  DEFAULT (getdate()) FOR [actualizado_en]
GO

GO

ALTER TABLE [dbo].[limites_tokens_rol] ADD  DEFAULT ((300000)) FOR [limite_diario_alerta]
GO

GO

ALTER TABLE [dbo].[limites_tokens_rol] ADD  DEFAULT ((6000000)) FOR [limite_mensual_corte]
GO

GO

ALTER TABLE [dbo].[limites_tokens_rol] ADD  DEFAULT ((1)) FOR [activo]
GO

GO

ALTER TABLE [dbo].[limites_tokens_rol] ADD  DEFAULT (getdate()) FOR [actualizado_en]
GO

GO

ALTER TABLE [dbo].[notificacion_vencimiento_log] ADD  DEFAULT (getdate()) FOR [creado_en]
GO

GO

ALTER TABLE [dbo].[usuario_perfil_ia] ADD  DEFAULT ((0)) FOR [total_conversaciones]
GO

GO

ALTER TABLE [dbo].[usuario_perfil_ia] ADD  DEFAULT (getdate()) FOR [ultima_actualizacion]
GO

GO

ALTER TABLE [dbo].[usuario_perfil_ia] ADD  DEFAULT ((0)) FOR [email_confirmado]
GO

GO

ALTER TABLE [dbo].[usuario_perfil_ia] ADD  DEFAULT ((1)) FOR [solicitar_email]
GO

GO

ALTER TABLE [dbo].[usuario_perfil_ia] ADD  DEFAULT ('PromoIQ IA') FOR [nombre_asistente]
GO

GO

ALTER TABLE [dbo].[usuario_perfil_ia] ADD  DEFAULT ('detallado') FOR [nivel_detalle]
GO

GO

ALTER TABLE [dbo].[usuarios] ADD  DEFAULT ((1)) FOR [activo]
GO

GO

ALTER TABLE [dbo].[usuarios] ADD  DEFAULT (getdate()) FOR [creado_en]
GO

GO

ALTER TABLE [dbo].[usuarios] ADD  DEFAULT ((0)) FOR [intentos_fallidos]
GO

GO

ALTER TABLE [dbo].[ventas_mes] ADD  DEFAULT (getdate()) FOR [fecha_carga]
GO

GO

ALTER TABLE [dbo].[auditoria_log]  WITH CHECK ADD FOREIGN KEY([usuario_id])
REFERENCES [dbo].[usuarios] ([id])
GO

GO

ALTER TABLE [dbo].[carga_log]  WITH CHECK ADD FOREIGN KEY([dinamica_id])
REFERENCES [dbo].[dinamicas] ([id])
GO

GO

ALTER TABLE [dbo].[carga_log]  WITH CHECK ADD FOREIGN KEY([usuario_id])
REFERENCES [dbo].[usuarios] ([id])
GO

GO

ALTER TABLE [dbo].[cat_categorias]  WITH CHECK ADD FOREIGN KEY([categoria_padre_id])
REFERENCES [dbo].[cat_categorias] ([id])
GO

GO

ALTER TABLE [dbo].[consultas_log]  WITH CHECK ADD FOREIGN KEY([usuario_id])
REFERENCES [dbo].[usuarios] ([id])
GO

GO

ALTER TABLE [dbo].[conversacion_mensajes]  WITH CHECK ADD FOREIGN KEY([conversacion_id])
REFERENCES [dbo].[conversaciones] ([id])
GO

GO

ALTER TABLE [dbo].[conversaciones]  WITH CHECK ADD FOREIGN KEY([usuario_id])
REFERENCES [dbo].[usuarios] ([id])
GO

GO

ALTER TABLE [dbo].[dinamica_detalle]  WITH CHECK ADD FOREIGN KEY([dinamica_id])
REFERENCES [dbo].[dinamicas] ([id])
GO

GO

ALTER TABLE [dbo].[dinamicas]  WITH CHECK ADD FOREIGN KEY([creado_por])
REFERENCES [dbo].[usuarios] ([id])
GO

GO

ALTER TABLE [dbo].[layout_tiendas]  WITH CHECK ADD  CONSTRAINT [FK_layout_tienda] FOREIGN KEY([tienda_codigo], [pais])
REFERENCES [dbo].[cat_tiendas] ([codigo], [pais])
GO
ALTER TABLE [dbo].[layout_tiendas] CHECK CONSTRAINT [FK_layout_tienda]
GO

GO

ALTER TABLE [dbo].[usuario_perfil_ia]  WITH CHECK ADD FOREIGN KEY([usuario_id])
REFERENCES [dbo].[usuarios] ([id])
GO

GO

ALTER TABLE [dbo].[usuarios]  WITH CHECK ADD FOREIGN KEY([rol_id])
REFERENCES [dbo].[cat_roles] ([id])
GO

GO

USE [master]
GO

GO

ALTER DATABASE [PromoIQ] SET  READ_WRITE 
GO