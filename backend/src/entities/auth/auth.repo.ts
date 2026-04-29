import { db } from "../../db/client.ts";
import { users, userCredentials, userRatings, userPresence } from "../../db/schema.ts";
import { eq } from "drizzle-orm";

export class AuthRepo {
    async createUser(data: {
        username: string;
        passwordHash: string;
        displayName?: string;
    }): Promise<{ userId: string }> {
        const result = await db.transaction(async (tx) => {
            const [user] = await tx
                .insert(users)
                .values({
                    username: data.username.toLowerCase(),
                    displayName: data.displayName || data.username,
                })
                .returning({ id: users.id });

            if (!user) {
                throw new Error("Failed to create user");
            }

            await tx.insert(userCredentials).values({
                userId: user.id,
                passwordHash: data.passwordHash,
            });

            await tx.insert(userRatings).values([
                { userId: user.id, timeClass: "bullet" },
                { userId: user.id, timeClass: "blitz" },
                { userId: user.id, timeClass: "rapid" },
                { userId: user.id, timeClass: "classical" },
            ]);

            await tx.insert(userPresence).values({
                userId: user.id,
            });

            return user;
        });

        return { userId: result.id };
    }

    async findByUsername(username: string) {
        const [user] = await db
            .select()
            .from(users)
            .where(eq(users.username, username.toLowerCase()))
            .limit(1);
        return user || null;
    }

    async findCredentialsByUserId(userId: string) {
        const [cred] = await db
            .select()
            .from(userCredentials)
            .where(eq(userCredentials.userId, userId))
            .limit(1);
        return cred || null;
    }
}

export const AuthRepoImpl = new AuthRepo();