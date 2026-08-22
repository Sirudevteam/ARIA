import asyncio
import sys
import uuid
if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
from app.core.config import get_settings

settings = get_settings()

async def seed():
    engine = create_async_engine(settings.DATABASE_URL, echo=False)
    try:
        async with engine.begin() as conn:
            # 1. Get or create Org
            org_res = await conn.execute(text("SELECT id FROM organizations LIMIT 1;"))
            org_row = org_res.fetchone()
            if not org_row:
                org_id = str(uuid.uuid4())
                await conn.execute(text(
                    f"INSERT INTO organizations (id, name, slug) VALUES ('{org_id}', 'Autocruise Dynamics AI', 'autocruise-ai');"
                ))
            else:
                org_id = str(org_row[0])

            # 2. Get or create Super Admin User
            user_res = await conn.execute(text("SELECT id FROM users LIMIT 1;"))
            user_row = user_res.fetchone()
            user_id = str(user_row[0]) if user_row else None

            # 3. Seed Projects
            projects = [
                ("Urban 3D Perception Project", "Multi-sensor LiDAR & camera 3D bounding box annotation for dense city traffic."),
                ("Highway LiDAR & Camera Fusion", "Long-range highway 128-beam LiDAR sensor tracking and high-speed trajectory labeling."),
                ("Nighttime Harsh Weather SOP", "Infrared and LiDAR point cloud perception guidelines for rain, fog, and nighttime driving."),
            ]

            for name, desc in projects:
                p_res = await conn.execute(text(f"SELECT id FROM projects WHERE name = :name;"), {"name": name})
                if not p_res.fetchone():
                    p_id = str(uuid.uuid4())
                    await conn.execute(
                        text("""
                            INSERT INTO projects (id, organization_id, name, description, status)
                            VALUES (:id, :org_id, :name, :desc, 'active');
                        """),
                        {"id": p_id, "org_id": org_id, "name": name, "desc": desc}
                    )
                    if user_id:
                        r_res = await conn.execute(text("SELECT id FROM roles WHERE name='SUPER_ADMIN' OR name='ADMIN' LIMIT 1;"))
                        r_row = r_res.fetchone()
                        if r_row:
                            await conn.execute(
                                text("""
                                    INSERT INTO project_members (id, project_id, user_id, role_id)
                                    VALUES (:id, :project_id, :user_id, :role_id)
                                    ON CONFLICT DO NOTHING;
                                """),
                                {"id": str(uuid.uuid4()), "project_id": p_id, "user_id": user_id, "role_id": str(r_row[0])}
                            )
                    print(f"Seeded project: {name}")

            print("Seed completed successfully!")
    except Exception as e:
        print(f"Seed error: {e}")
    finally:
        await engine.dispose()

if __name__ == "__main__":
    asyncio.run(seed())
