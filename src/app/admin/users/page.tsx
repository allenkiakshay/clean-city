import { connectMongo } from "@/lib/mongo";
import { User } from "@/models/User";
import { UserRoleForm } from "./user-role-form";

export default async function AdminUsersPage() {
  await connectMongo();
  const users = await User.find()
    .sort({ role: 1, email: 1 })
    .select("name email role trustScore points")
    .lean();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Users</h1>
        <p className="text-muted-foreground">
          Grant admin or worker roles. Self-registration always lands as citizen.
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Role</th>
              <th className="px-4 py-3 font-medium">Trust</th>
              <th className="px-4 py-3 font-medium">Points</th>
              <th className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user._id.toString()} className="border-t">
                <td className="px-4 py-3">{user.name ?? "—"}</td>
                <td className="px-4 py-3">{user.email}</td>
                <td className="px-4 py-3">{user.role}</td>
                <td className="px-4 py-3">{user.trustScore}</td>
                <td className="px-4 py-3">{user.points}</td>
                <td className="px-4 py-3">
                  <UserRoleForm
                    userId={user._id.toString()}
                    currentRole={user.role}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
