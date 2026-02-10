import os
import sys
import argparse
from pymongo import MongoClient
from dotenv import load_dotenv

# Add parent directory to path to import config if needed, 
# but we'll use direct env vars for simplicity in this standalone script
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

def sanitize_urls(dry_run=False):
    load_dotenv()
    
    mongo_uri = os.getenv("MONGO_URI")
    db_name = os.getenv("MONGO_DB", "fitness_app") # Default fallback

    if not mongo_uri:
        print("Error: MONGO_URI not found in environment variables.")
        return

    try:
        client = MongoClient(mongo_uri)
        db = client[db_name]
        collection = db.exercises
        
        print(f"Connected to database: {db_name}")
        print(f"Target collection: exercises")
        print(f"Mode: {'DRY RUN (No changes will be saved)' if dry_run else 'LIVE EXECUTION'}")
        
        # Find documents with the old URL pattern
        query = {"video_url": {"$regex": "youtube.com/embed"}}
        cursor = collection.find(query)
        
        count = collection.count_documents(query)
        print(f"Found {count} documents to process.\n")
        
        updated_count = 0
        
        for doc in cursor:
            original_url = doc.get("video_url", "")
            
            # Simple parsing logic
            # Expected format: https://www.youtube.com/embed/VIDEO_ID?rel=0
            # We want: https://youtu.be/VIDEO_ID
            
            if "/embed/" in original_url:
                try:
                    # Split by /embed/
                    parts = original_url.split("/embed/")
                    if len(parts) > 1:
                        # part[1] is like "VIDEO_ID?rel=0" or just "VIDEO_ID"
                        video_id_part = parts[1]
                        
                        # Remove query parameters if any (like ?rel=0)
                        video_id = video_id_part.split("?")[0]
                        
                        new_url = f"https://youtu.be/{video_id}"
                        
                        if dry_run:
                            print(f"[DRY RUN] Would update: {original_url} -> {new_url}")
                        else:
                            # Update the document
                            collection.update_one(
                                {"_id": doc["_id"]},
                                {"$set": {"video_url": new_url}}
                            )
                            # print(f"Updated: {original_url} -> {new_url}") # Optional: reduce noise
                        
                        updated_count += 1
                except Exception as e:
                    print(f"Error processing URL {original_url}: {e}")
            
        print(f"\nProcessing complete.")
        print(f"Total documents {'would be' if dry_run else 'were'} updated: {updated_count}")

    except Exception as e:
        print(f"An error occurred: {e}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Sanitize YouTube URLs in exercises collection.")
    parser.add_argument("--dry-run", action="store_true", help="Print changes without executing them.")
    args = parser.parse_args()
    
    sanitize_urls(dry_run=args.dry_run)
