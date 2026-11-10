# Federación de identidad para ciencia ciudadana (Ibercivis)

## Estado de la consulta

Correo de calibración enviado a Kike (Veridas) el **10 de noviembre de 2026**, con el contexto de
abajo y una única pregunta: si tienen en el equipo gente con rodaje en Keycloak en producción, en
OIDC/OAuth2 como proveedor (no como consumidor), o en federación.

Este documento es el **segundo paso**: las preguntas concretas, para recortarlas a lo que su respuesta
diga que saben. Los bloques marcados **[P]** son del piloto y nos bloquean antes de enero; los
marcados **[F]** son de fases posteriores, y lo que buscamos ahí es no meternos en un callejón sin
salida, no una decisión ya.

Aviso de calibración: su documentación pública (VeriSaaS, vali-Das, das-Face, Keymaker, XpressID) es
toda verificación documental y biometría consumida por API, con autenticación por API key. No hay
rastro de OIDC como proveedor, SAML, Keycloak, eIDAS 2, EUDI Wallet ni OpenID Federation. No prueba
que no lo tengan — su web de marketing no se pudo leer — pero sí dice que el valor más probable está
en el bloque 5, y que los bloques 1 a 4 pueden no tener interlocutor.

## Contexto

Estamos trabajando en una fundación de ciencia (Ibercivis) construyendo un **Broker de identidad**
único para las aplicaciones de ciencia ciudadana. Hoy cada aplicación tiene su propio registro, su
propia contraseña y su propio "¿verifica tu email?", y una persona que participa en dos proyectos es,
para el software, dos desconocidos distintos.

El piloto plantea tener estas piezas:

- **Keycloak** como Broker, detrás de un reverse proxy en todos los entornos.
- **Google, GitHub y ORCID**, entre otras, como fuentes de identidad.
- **Authorization Code + PKCE (S256)**.
- A futuro, una capa de **OpenID Federation**.
- Y, por otra vía, integrarnos en **EOSC**, donde entendemos que el camino es AARC BPA / eduGAIN.

Nos vendría genial el criterio de gente que ya ha operado esto en producción. El piloto cierra a
finales de enero, así que lo que más nos sirve es criterio pronto, no exhaustividad.

## 1. Extender Keycloak: acuñar el identificador de persona

Esta es la parte del piloto con más riesgo técnico, porque toca algo que Keycloak considera suyo.

1.1. Necesitamos que `sub` **no** sea el id interno de usuario de Keycloak, sino nuestro UUID con
dominio, y que el mismo valor aparezca en ID token, userinfo, **introspection** y access token.
¿Habéis sobrescrito `sub` en Keycloak alguna vez? ¿Con qué: un mapper declarativo, un `ProtocolMapper`
propio implementando `OIDCIDTokenMapper`/`OIDCAccessTokenMapper`/`UserInfoTokenMapper`, el modo
*pairwise*, o algo más? ¿Qué dejó de funcionar al hacerlo?

1.2. ¿Reemplazar `sub` rompe algo de las tripas de Keycloak que dependa de él — búsqueda de sesión,
*back-channel logout* (el `logout_token` lleva `sub`), offline tokens, Admin API, Account Console?
Lo preguntamos porque nuestra sospecha es que el riesgo está aquí y no en el mapper.

1.3. ¿Dónde guardaríais el identificador: atributo de usuario + mapper, declaración en *User Profile*,
o `User Storage SPI`? Nos interesa cuál de esas opciones **aguanta mejor las actualizaciones** de
Keycloak, no cuál es más elegante.

1.4. Momento de acuñación. Valoramos tres caminos: un authenticator propio en el flujo
*first broker login*, un `EventListenerProvider` escuchando el registro, o acuñar desde fuera con la
Admin API. ¿Cuál habéis visto sostenerse? Y en concreto: **¿qué garantiza la idempotencia** si la misma
persona abre dos pestañas y arranca dos logins en paralelo — acabamos con dos UUID?

1.5. Coste real de mantener SPIs propios: ¿con qué frecuencia os ha roto una subida de versión de
Keycloak una extensión, y qué SPIs consideráis estables frente a los que son interfaz interna
disfrazada de API?

1.6. Un SPI propio obliga a construir imagen propia de Keycloak. ¿Cómo lo lleváis en CI — build de
imagen por versión de Keycloak, tests de la extensión contra varias versiones, o fijáis una y no la
tocáis?

---

## 2. Configuración como código, y operación

2.1. Para declarar realm, clientes y fuentes de identidad como código y aplicarlo de forma
reproducible: ¿*partial import* al arrancar, `kc.sh import`, **keycloak-config-cli**, el **provider de
Terraform**, u otra cosa? ¿Cuál no acaba peleándose con el hecho de que la base de datos es la fuente de
verdad real de Keycloak?

2.2. **Detección de deriva**: ¿cómo sabéis que lo que corre es lo que está declarado? ¿Tenéis algo que
compare, o lo asumís?

2.3. Secretos: *client secrets*, secretos de los IdP upstream, claves de firma. ¿Cómo los inyectáis y
cómo los **rotáis** sin forzar un re-login masivo ni romper a las aplicaciones?

2.4. Cadencia de actualización. Keycloak publica muy a menudo. ¿Fijáis versión, seguís una línea de
soporte, o vais al día? ¿Qué os ha mordido en las subidas — temas, SPIs, migraciones de esquema?

2.5. Reverse proxy. Nuestra decisión es que el `issuer` sale de configuración, **nunca de la base de
datos** y nunca reconstruido concatenando trozos, para poder cambiar el hostname definitivo más tarde
sin migrar datos. ¿Hay algún comportamiento de Keycloak (hostname v2, `--hostname-admin`,
`--hostname-backchannel-dynamic`, modos de `proxy-headers`) que contradiga eso en la práctica? ¿Qué
trampas habéis visto con cookies, redirect URIs y CORS detrás de proxy?

2.6. Dimensionado honesto para algo pequeño: ¿una instancia y backups de PostgreSQL es suficiente, o
hace falta clustering Infinispan desde el principio? ¿Qué se rompe primero cuando crece?

---

## 3. Vinculación de identidades, sesión y logout  **[P]**

3.1. Queremos que Keycloak **nunca** vincule por email. ¿Cómo se consigue de forma que no dependa de
que nadie toque una casilla: qué hay que quitar del flujo *first broker login*, y qué pasa con las
pantallas de "ya existe una cuenta con este email" que Keycloak muestra por defecto?

3.2. ¿Habéis construido un flujo de vinculación explícita, en el que la persona demuestra control de
ambas cuentas? ¿Usasteis el endpoint `/broker/{provider}/link` con su `nonce`/hash, y lo consideráis
una vía soportada y estable? ¿Funciona desde un cliente público (SPA)?

3.3. Keycloak vincula un IdP a un usuario **existente**; no fusiona usuarios. Cuando a una persona le
han quedado dos usuarios distintos que deberían ser uno, ¿qué hacéis? ¿Hay algún camino de fusión que
no sea reasignar datos a mano en cada aplicación?

3.4. **Logout propagado**: una de nuestras historias de usuario exige que cerrar sesión cierre sesión
en las aplicaciones a las que se entró. ¿Qué fiabilidad real tiene el *back-channel logout* de
Keycloak? ¿Qué falla en silencio y cómo lo monitorizáis?

3.5. Duraciones: SSO idle/max recomendados para un escenario de varias aplicaciones, y política de
refresh tokens para SPAs (rotación, *Revoke Refresh Token*). ¿Usaríais refresh tokens en navegador, o
`prompt=none` contra la sesión del Broker?

3.6. **ORCID** como IdP de Keycloak: ¿lo habéis integrado? Nos consta que su OIDC tiene aristas (email
no siempre presente, sandbox vs producción, API pública vs de miembro). ¿Algo específico que nos vaya a
costar un día de trabajo?

---

## 4. OpenID Federation y el horizonte federado  **[F]**

Contexto: OpenID Federation 1.0 es especificación final desde febrero de 2026 (1.1 en mayo). Nuestra
lectura es que **Keycloak upstream eligió otra dirección**: no tiene código de OIDF ni punto de
extensión para ello, y lo único del lado proveedor en open source vive en un fork. Por eso planeamos la
capa de federación como componente separable, y por eso esto es investigación y no una decisión tomada.

4.1. ¿Habéis implementado o evaluado OpenID Federation en algún proyecto — *entity statements*, trust
anchor, cadenas de confianza, registro automático de clientes? Si la respuesta es no, decidlo y
saltamos el bloque.

4.2. De los tres caminos que vemos — **(a)** cargar con un fork de Keycloak, **(b)** escribir un
plugin contra puntos de extensión que no existen, **(c)** poner delante un proveedor capaz de OIDF con
Keycloak detrás como autenticador — ¿cuál habéis visto funcionar? ¿Conocéis los forks existentes (el
trabajo italiano de AgID para SPID/CIE, el de SUNET) o SATOSA / `fedservice` de IdentityPython como
capa frontal?

4.3. Si se pone un proveedor delante, ¿qué se rompe? Nos preocupa concretamente: qué `issuer` ven las
aplicaciones, la sesión y el logout a través de dos saltos, el consentimiento duplicado, y sobre todo
**cómo se mantiene estable nuestro identificador de persona atravesando dos capas**.

4.4. Coste operativo real de pertenecer a una federación: claves de firma de metadatos, cadencia de
renovación de *entity statements*, rotación de claves, qué pasa el día que caduca algo. ¿Es un trabajo
de una tarde al año o una guardia?

4.5. ¿En el ecosistema de investigación veis más realista la vía **AARC BPA / Infrastructure Proxy**
(eduGAIN, todavía muy SAML) que OIDF? Nuestra referencia de identificadores es **AARC-G026**.

4.6. ¿Alguien consume OIDF de verdad hoy en España — FNMT, Cl@ve, pilotos EUDI? ¿Quién podría ser un
trust anchor realista para una fundación como la nuestra?

---

## 5. Garantía de identidad y verificación — vuestro terreno  **[F]**

5.1. Hoy toda nuestra garantía es "ha entrado con Google". En fases posteriores habrá acciones que
pidan más (publicar datos, coordinar un proyecto). ¿Cuál es el **escalón más barato y proporcionado**
por encima de eso para una fundación sin ánimo de lucro: verificación documental una vez en el
*enrolment*, Cl@ve/eIDAS, o directamente nada y confiar en moderación?

5.2. ¿El resultado de una verificación vuestra se puede consumir como **un claim que guardamos una vez**
contra la persona, sin que nosotros custodiemos biometría ni documentos? ¿Qué devuelve exactamente
vali-Das/XpressID, y cuál es el **mínimo** que tendríamos que almacenar para poder demostrar más tarde
que la comprobación ocurrió?

5.3. Forma de integración: ¿hay manera soportada de invocar un flujo de verificación **dentro** de un
flujo de autenticación OIDC (un *step-up* en el propio IdP), o siempre es un flujo de aplicación antes
o después del login? ¿Habéis integrado con Keycloak o con cualquier IAM como autenticador de step-up?

5.4. La pregunta incómoda: la calidad del dato en ciencia ciudadana se degrada con cuentas duplicadas,
y nosotros hemos **renunciado a vincular por email**. ¿Qué recomendáis contra duplicados que **no** sea
deduplicación facial? Y si alguien propusiera das-FaceBond: ¿qué implica de verdad en GDPR tratar
categoría especial de datos de voluntarios, a nuestra escala, y nos lo desaconsejaríais vosotros mismos?

5.5. **Menores**: hay ciencia ciudadana en colegios. Verificación de edad y consentimiento parental,
¿qué funciona de verdad y qué estáis viendo hacer a vuestros clientes?

5.6. **EUDI Wallet**: ¿está en vuestra hoja de ruta como origen de atributos? ¿Tiene sentido imaginar
una futura fuente de identidad que sea una cartera EUDI vía OpenID4VP, y tenéis algo corriendo?
Agradeceríamos una estimación realista de fechas más que la oficial.

5.7. Modelo de precios, en grueso: ¿por verificación, con mínimos? Lo preguntamos solo para saber si
merece la pena diseñar pensando en ello o descartarlo ya.

---

## 6. Forma de la consulta  **[P]**

6.1. ¿Quién es la persona adecuada para cada bloque, y qué formato os cuesta menos: escrito asíncrono,
una llamada de una hora, o acceso a un sandbox?

6.2. ¿Estaríais dispuestos a leer nuestra especificación y nuestros tres ADR (tres documentos cortos) y
decirnos **dónde nos estamos equivocando**? Es lo más valioso que podemos pediros y lo que menos
tiempo os cuesta de preparar.
