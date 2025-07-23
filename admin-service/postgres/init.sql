-- init.sql

-- Activate the dblink extension
CREATE EXTENSION IF NOT EXISTS dblink;

-- Create database airflow_db if it doesn't exist
DO $$
BEGIN
   IF NOT EXISTS (
      SELECT FROM pg_database WHERE datname = 'airflow_db'
   ) THEN
      PERFORM dblink_exec('dbname=postgres', 'CREATE DATABASE airflow_db');
   END IF;
END $$;

-- Create database hive_metastore if it doesn't exist
DO $$
BEGIN
   IF NOT EXISTS (
      SELECT FROM pg_database WHERE datname = 'hive_metastore'
   ) THEN
      PERFORM dblink_exec('dbname=postgres', 'CREATE DATABASE hive_metastore');
   END IF;
END $$;
