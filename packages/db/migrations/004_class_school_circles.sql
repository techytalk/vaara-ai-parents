-- Class and school circle types

ALTER TYPE circle_type ADD VALUE IF NOT EXISTS 'class';
ALTER TYPE circle_type ADD VALUE IF NOT EXISTS 'school';
