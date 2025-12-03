import { User } from "../models/User";

/**
 * Generate the next sequential userId in format CROWN-XXXXXX
 * @returns Promise<string> - Next available userId (e.g., CROWN-000001)
 */
export async function generateNextUserId(): Promise<string> {
  // Find the user with the highest userId
  const lastUser = await User.findOne(
    { userId: { $regex: /^CROWN-/ } },
    {},
    { sort: { userId: -1 } }
  );

  if (!lastUser || !lastUser.userId) {
    // No users exist, return root user ID
    return "CROWN-000000";
  }

  // Extract the number part from the last userId
  const match = lastUser.userId.match(/CROWN-(\d+)/);
  if (!match) {
    // If format is wrong, start from 000000
    return "CROWN-000000";
  }

  const lastNumber = parseInt(match[1], 10);
  const nextNumber = lastNumber + 1;

  // Format as 6-digit number with leading zeros
  const formattedNumber = nextNumber.toString().padStart(6, "0");
  return `CROWN-${formattedNumber}`;
}

/**
 * Find user by userId (CROWN-XXXXXX format)
 * @param userId - User ID in format CROWN-XXXXXX
 * @returns Promise<User | null>
 */
export async function findUserByUserId(userId: string) {
  return await User.findOne({ userId });
}

