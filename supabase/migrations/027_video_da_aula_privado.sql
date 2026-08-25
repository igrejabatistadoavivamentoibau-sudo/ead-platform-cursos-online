-- ============================================================
-- O VÍDEO ENVIADO PARA A PLATAFORMA DEIXA DE SER PÚBLICO
--
-- A área 'aulas' estava marcada como pública e tinha uma política de
-- leitura para TODO MUNDO: quem tivesse o endereço assistia sem login,
-- sem estar matriculado e para sempre. O endereço é aleatório, mas basta
-- alguém repassá-lo uma vez.
--
-- Passa a funcionar como 'entregas' e 'materiais': área privada, e o
-- acesso só por endereço ASSINADO, gerado pelo servidor depois de
-- conferir quem está pedindo (app/api/aulas/[id]/video/route.ts).
--
-- NÃO EXISTE MAIS POLÍTICA DE LEITURA nesta área, e isso é de propósito:
-- é mais fechado que 'materiais', que ainda deixa qualquer pessoa logada
-- ler direto. Aqui ninguém alcança o arquivo pelo caminho normal. Quem
-- assina é a chave administrativa, que ignora estas políticas por
-- natureza e nunca sai do servidor.
--
-- NENHUM ARQUIVO É APAGADO OU MOVIDO. Os vídeos já enviados continuam
-- onde estão, com o mesmo caminho no banco (`aulas.video_path`); o que
-- muda é o modo de alcançá-los.
--
-- VÍDEO DE FORA NÃO É AFETADO. YouTube, Vimeo, Google Drive e OneDrive
-- nunca passaram por esta área — aquele link é do provedor e continua
-- indo direto para o player.
-- ============================================================

update storage.buckets set public = false where id = 'aulas';

drop policy if exists "Leitura publica dos videos de aula" on storage.objects;

-- ------------------------------------------------------------
-- De passagem, o outro lado da mesma porta.
--
-- Enviar e apagar vídeo estava liberado para QUALQUER PESSOA LOGADA —
-- inclusive aluno. Ninguém explorou porque a tela de envio só aparece
-- para quem dá aula, mas tela que esconde botão não é tranca.
-- Alinhado com 'materiais': só quem dá aula ou coordena.
-- ------------------------------------------------------------
drop policy if exists "Equipe envia videos de aula" on storage.objects;
create policy "Equipe envia videos de aula"
  on storage.objects for insert
  with check (bucket_id = 'aulas' and (is_admin() or e_professor()));

drop policy if exists "Equipe remove videos de aula" on storage.objects;
create policy "Equipe remove videos de aula"
  on storage.objects for delete
  using (bucket_id = 'aulas' and (is_admin() or e_professor()));
