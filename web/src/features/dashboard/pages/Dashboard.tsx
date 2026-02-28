import { Card } from "../../../components/ui/Card";

export function Dashboard() {
    return (
        <div>
            <h1 style={{ fontSize: "1.5rem", fontWeight: "bold", marginBottom: "1rem" }}>Dashboard</h1>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1rem" }}>
                <Card>
                    <h2 className="card-title">Total Passwords</h2>
                    <p className="card-desc" style={{ fontSize: "2rem", color: "var(--color-security-blue)" }}>0</p>
                </Card>
                <Card>
                    <h2 className="card-title">Security Score</h2>
                    <p className="card-desc" style={{ fontSize: "2rem", color: "var(--color-soft-green)" }}>100%</p>
                </Card>
                <Card>
                    <h2 className="card-title">Active Devices</h2>
                    <p className="card-desc" style={{ fontSize: "2rem", color: "var(--color-amber)" }}>1</p>
                </Card>
            </div>
        </div>
    );
}
