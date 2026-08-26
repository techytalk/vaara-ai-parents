-- Activity full-text search vector trigger

CREATE OR REPLACE FUNCTION activities_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    to_tsvector('english', coalesce(NEW.title, '') || ' ' || coalesce(NEW.description, ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS activities_search_vector_trigger ON activities;

CREATE TRIGGER activities_search_vector_trigger
  BEFORE INSERT OR UPDATE OF title, description ON activities
  FOR EACH ROW
  EXECUTE FUNCTION activities_search_vector_update();
