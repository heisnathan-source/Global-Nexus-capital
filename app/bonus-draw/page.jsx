"use client";

import { useEffect, useState } from "react";

export default function BonusDrawPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadBonusDraw() {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(
        "/api/bonus-draw",
        {
          cache: "no-store"
        }
      );

      const result =
        await response.json();

      if (!response.ok) {
        throw new Error(
          result.error ||
            "Unable to load Bonus Draw."
        );
      }

      setData(result);

    } catch (err) {
      console.error(err);

      setError(
        err.message ||
          "Unable to load Bonus Draw."
      );

    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadBonusDraw();
  }, []);

  function formatMoney(amount) {
    return new Intl.NumberFormat(
      "en-GH",
      {
        style: "currency",
        currency: "GHS",
        minimumFractionDigits: 2
      }
    ).format(
      Number(amount || 0)
    );
  }

  if (loading) {
    return (
      <main style={styles.page}>
        <div style={styles.loading}>
          Loading Bonus Draw...
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main style={styles.page}>
        <div style={styles.error}>
          {error}
        </div>

        <button
          onClick={loadBonusDraw}
          style={styles.retryButton}
        >
          Try Again
        </button>
      </main>
    );
  }

  if (!data) {
    return null;
  }

  return (
    <main style={styles.page}>

      <header style={styles.header}>
        <button
          onClick={() =>
            window.history.back()
          }
          style={styles.backButton}
        >
          ←
        </button>

        <h1 style={styles.title}>
          Bonus Draw
        </h1>

        <div
          style={{
            width: 40
          }}
        />
      </header>

      {!data.enabled && (
        <div style={styles.disabledBox}>
          Bonus Draw is currently unavailable.
        </div>
      )}

      <section style={styles.heroCard}>
        <div style={styles.heroLabel}>
          THIS WEEK&apos;S DEPOSIT
        </div>

        <div style={styles.depositAmount}>
          {formatMoney(
            data.depositTotal
          )}
        </div>

        <div style={styles.rewardText}>
          Your successful deposits are being
          counted toward your Bonus Draw stages.
        </div>
      </section>

      {data.nextStage ? (
        <section style={styles.nextStageCard}>
          <div style={styles.sectionLabel}>
            NEXT BONUS STAGE
          </div>

          <div style={styles.nextStageNumber}>
            Stage{" "}
            {data.nextStage.stageNumber}
          </div>

          <div style={styles.nextStageRequirement}>
            Continue making successful deposits
            to progress toward the next stage.
          </div>
        </section>
      ) : (
        <section style={styles.completedCard}>
          🎉 You have reached all available
          Bonus Draw stages this week!
        </section>
      )}

      <section style={styles.stagesSection}>
        <h2 style={styles.sectionTitle}>
          Bonus Stages
        </h2>

        {data.stages.length === 0 ? (
          <div style={styles.emptyBox}>
            No Bonus Draw stages are available yet.
          </div>
        ) : (
          data.stages.map(stage => (
            <div
              key={stage.id}
              style={{
                ...styles.stageCard,
                ...(stage.rewarded
                  ? styles.rewardedStage
                  : stage.reached
                    ? styles.reachedStage
                    : {})
              }}
            >
              <div style={styles.stageLeft}>
                <div style={styles.stageNumber}>
                  Stage{" "}
                  {stage.stageNumber}
                </div>

                <div style={styles.stageDeposit}>
                  {stage.rewarded
                    ? "This stage has been completed."
                    : stage.reached
                      ? "Eligible for processing."
                      : "Progress is being tracked."
                  }
                </div>
              </div>

              <div style={styles.stageRight}>
                {stage.rewarded ? (
                  <>
                    <div style={styles.rewardAmount}>
                      {formatMoney(
                        stage.rewardAmount
                      )}
                    </div>

                    <div style={styles.stageStatus}>
                      ✓ Reward Received
                    </div>
                  </>
                ) : (
                  <div style={styles.stageStatus}>
                    {stage.reached
                      ? "Eligible"
                      : "In Progress"}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </section>

      <section style={styles.infoCard}>
        <h3 style={styles.infoTitle}>
          How Bonus Draw Works
        </h3>

        <p style={styles.infoText}>
          Your successful deposits during the
          current week count toward your Bonus
          Draw stages.
        </p>

        <p style={styles.infoText}>
          When you reach a qualifying stage,
          the corresponding reward is processed
          after the qualifying deposit has been
          verified.
        </p>

        <p style={styles.infoText}>
          Bonus Draw stage requirements are
          controlled by Global Nexus Capital administration.
        </p>
      </section>

      <button
        onClick={loadBonusDraw}
        style={styles.refreshButton}
      >
        Refresh
      </button>

    </main>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "#f5f6fa",
    paddingBottom: 40,
    fontFamily:
      "Arial, Helvetica, sans-serif"
  },

  header: {
    height: 60,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 18px",
    background: "#ffffff",
    borderBottom:
      "1px solid #e8e8e8"
  },

  title: {
    margin: 0,
    fontSize: 19,
    fontWeight: 700
  },

  backButton: {
    width: 40,
    height: 40,
    border: "none",
    background: "transparent",
    fontSize: 28,
    cursor: "pointer"
  },

  loading: {
    padding: 40,
    textAlign: "center"
  },

  error: {
    margin: 20,
    padding: 18,
    background: "#ffe5e5",
    borderRadius: 12,
    color: "#b00020"
  },

  retryButton: {
    marginLeft: 20,
    padding: "12px 20px",
    border: "none",
    borderRadius: 10,
    cursor: "pointer"
  },

  disabledBox: {
    margin: 16,
    padding: 15,
    background: "#fff3cd",
    borderRadius: 12,
    textAlign: "center"
  },

  heroCard: {
    margin: 16,
    padding: 25,
    borderRadius: 18,
    background:
      "linear-gradient(135deg, #6a11cb, #2575fc)",
    color: "#ffffff",
    textAlign: "center"
  },

  heroLabel: {
    fontSize: 12,
    opacity: 0.85,
    letterSpacing: 1
  },

  depositAmount: {
    fontSize: 32,
    fontWeight: 800,
    marginTop: 10
  },

  rewardText: {
    marginTop: 10,
    fontSize: 14,
    lineHeight: 1.5
  },

  nextStageCard: {
    margin: 16,
    padding: 20,
    background: "#ffffff",
    borderRadius: 16,
    boxShadow:
      "0 4px 15px rgba(0,0,0,0.05)"
  },

  sectionLabel: {
    fontSize: 11,
    color: "#777",
    fontWeight: 700,
    letterSpacing: 1
  },

  nextStageNumber: {
    fontSize: 22,
    fontWeight: 800,
    marginTop: 8
  },

  nextStageRequirement: {
    marginTop: 8,
    color: "#666",
    fontSize: 14,
    lineHeight: 1.5
  },

  completedCard: {
    margin: 16,
    padding: 20,
    borderRadius: 16,
    background: "#e6ffed",
    textAlign: "center",
    fontWeight: 600
  },

  stagesSection: {
    margin: 16
  },

  sectionTitle: {
    fontSize: 18,
    marginBottom: 14
  },

  stageCard: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 18,
    background: "#ffffff",
    borderRadius: 15,
    marginBottom: 12,
    border:
      "1px solid #eeeeee"
  },

  reachedStage: {
    border:
      "1px solid #9ed8b1"
  },

  rewardedStage: {
    background: "#f0fff4",
    border:
      "1px solid #63c77d"
  },

  stageLeft: {
    flex: 1
  },

  stageNumber: {
    fontWeight: 700,
    fontSize: 16
  },

  stageDeposit: {
    marginTop: 6,
    fontSize: 13,
    color: "#777"
  },

  stageRight: {
    textAlign: "right"
  },

  rewardAmount: {
    fontWeight: 800,
    fontSize: 16
  },

  stageStatus: {
    marginTop: 5,
    fontSize: 12,
    color: "#666"
  },

  emptyBox: {
    padding: 20,
    background: "#ffffff",
    borderRadius: 12,
    textAlign: "center",
    color: "#777"
  },

  infoCard: {
    margin: 16,
    padding: 20,
    background: "#ffffff",
    borderRadius: 16
  },

  infoTitle: {
    marginTop: 0,
    fontSize: 17
  },

  infoText: {
    fontSize: 14,
    lineHeight: 1.6,
    color: "#666"
  },

  refreshButton: {
    display: "block",
    width: "calc(100% - 32px)",
    margin: "20px auto",
    padding: 15,
    border: "none",
    borderRadius: 14,
    background: "#111827",
    color: "#ffffff",
    fontWeight: 700,
    fontSize: 15,
    cursor: "pointer"
  }
};
