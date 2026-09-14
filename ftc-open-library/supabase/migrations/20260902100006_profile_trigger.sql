-- Create a public.profiles row whenever a Supabase auth user is created.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  base_username text;
  final_username text;
  suffix integer := 0;
BEGIN
  base_username := lower(
    regexp_replace(
      coalesce(
        NEW.raw_user_meta_data ->> 'username',
        split_part(NEW.email, '@', 1),
        'user'
      ),
      '[^a-z0-9_]',
      '',
      'g'
    )
  );

  IF char_length(base_username) < 3 THEN
    base_username := 'user' || substr(replace(NEW.id::text, '-', ''), 1, 8);
  END IF;

  base_username := left(base_username, 32);
  final_username := base_username;

  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE username = final_username) LOOP
    suffix := suffix + 1;
    final_username := left(base_username, greatest(3, 32 - char_length(suffix::text) - 1))
      || '_'
      || suffix::text;
  END LOOP;

  INSERT INTO public.profiles (id, username, display_name)
  VALUES (
    NEW.id,
    final_username,
    nullif(NEW.raw_user_meta_data ->> 'display_name', '')
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;
