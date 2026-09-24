"use client";

import Link from "next/link";

import {
  useEffect,
  useMemo,
  useState
} from "react";


const filters = [

  ["All", "all"],

  ["Revenue", "revenue"],

  ["Expenditure", "expenditure"],

  ["Deposit", "deposit"],

  ["Withdrawal", "withdrawal"]

];


function getCategory(record) {

  const type =
    String(
      record?.type || ""
    ).toLowerCase();


  const entryType =
    String(
      record?.entry_type || ""
    ).toLowerCase();


  const description =
    String(
      record?.description || ""
    ).toLowerCase();


  if (
    type === "withdrawal" ||
    entryType.includes("withdrawal") ||
    description.includes("withdrawal")
  ) {
    return "withdrawal";
  }


  if (
    type === "deposit" ||
    entryType === "deposit" ||
    description.includes("deposit")
  ) {
    return "deposit";
  }


  if (
    type === "task_earning" ||
    entryType.includes("earning") ||
    entryType.includes("commission") ||
    description.includes("earning")
  ) {
    return "revenue";
  }


  if (
    type === "fund_purchase" ||
    type === "rank_purchase" ||
    type === "purchase" ||
    entryType.includes("purchase") ||
    entryType.includes("fund")
  ) {
    return "expenditure";
  }


  return "other";

}


function getWithdrawalStatus(record) {

  const status =
    String(

      record?.withdrawal_status ||

      record?.status ||

      ""

    )
      .trim()
      .toLowerCase();


  /*
   * SUCCESSFUL
   */

  if (
    [

      "approved",

      "paid",

      "successful",

      "success",

      "completed",

      "complete"

    ].includes(status)
  ) {

    return {

      key: "successful",

      label: "Successful"

    };

  }


  /*
   * REJECTED
   */

  if (
    [

      "rejected",

      "declined",

      "failed",

      "cancelled",

      "canceled"

    ].includes(status)
  ) {

    return {

      key: "rejected",

      label: "Rejected"

    };

  }


  /*
   * PENDING
   */

  return {

    key: "pending",

    label: "Pending"

  };

}


function getTitle(record) {

  const category =
    getCategory(record);


  if (
    category === "withdrawal"
  ) {

    const status =
      getWithdrawalStatus(record);


    if (
      status.key === "pending"
    ) {

      return "Withdrawal Pending";

    }


    if (
      status.key === "successful"
    ) {

      return "Withdrawal Successful";

    }


    return "Withdrawal Rejected";

  }


  if (
    category === "deposit"
  ) {

    return "Deposit";

  }


  if (
    category === "revenue"
  ) {

    return (
      record?.description ||
      "Revenue"
    );

  }


  if (
    category === "expenditure"
  ) {

    return (
      record?.description ||
      "Purchase"
    );

  }


  return (

    record?.description ||

    "Transaction"

  );

}


function isCredit(record) {

  const category =
    getCategory(record);


  if (
    category === "revenue" ||
    category === "deposit"
  ) {

    return true;

  }


  /*
   * A rejected withdrawal is refunded,
   * so display it as a credit/refund.
   */

  if (
    category === "withdrawal"
  ) {

    const status =
      getWithdrawalStatus(record);


    return (
      status.key === "rejected"
    );

  }


  return (
    Number(
      record?.amount || 0
    ) > 0
  );

}


function formatAmount(value) {

  return Math.abs(
    Number(value || 0)
  ).toLocaleString(
    "en-GH",
    {

      minimumFractionDigits: 0,

      maximumFractionDigits: 2

    }
  );

}


function formatDate(value) {

  if (!value) {
    return "—";
  }


  const date =
    new Date(value);


  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "—";
  }


  return date.toLocaleString(
    "en-GB",
    {

      day: "2-digit",

      month: "2-digit",

      year: "numeric",

      hour: "2-digit",

      minute: "2-digit",

      hour12: false

    }
  );

}


export default function FinancialRecordsPage() {

  const [records, setRecords] =
    useState([]);


  const [totals, setTotals] =
    useState({

      credits: 0,

      debits: 0

    });


  const [
    activeFilter,
    setActiveFilter
  ] =
    useState("all");


  const [loading, setLoading] =
    useState(true);


  const [error, setError] =
    useState("");


  async function loadRecords() {

    try {

      setLoading(true);

      setError("");


      const response =
        await fetch(
          "/api/financial-records",
          {
            cache: "no-store"
          }
        );


      const data =
        await response.json();


      if (!response.ok) {

        throw new Error(

          data?.error ||

          "Unable to load financial records."

        );

      }


      setRecords(

        Array.isArray(
          data?.records
        )

          ? data.records

          : []

      );


      setTotals({

        credits:
          Number(
            data?.totals?.credits || 0
          ),

        debits:
          Number(
            data?.totals?.debits || 0
          )

      });

    } catch (err) {

      setError(

        err?.message ||

        "Unable to load financial records."

      );

    } finally {

      setLoading(false);

    }

  }


  useEffect(() => {

    loadRecords();

  }, []);


  const filteredRecords =
    useMemo(() => {

      if (
        activeFilter === "all"
      ) {

        return records;

      }


      return records.filter(
        record =>

          getCategory(record) ===
          activeFilter

      );

    }, [

      records,

      activeFilter

    ]);


  return (

    <main className="mobile-shell scroll-page">

      <header className="topbar">

        <div>

          <div className="eyebrow">
            Global Nexus Capital
          </div>

          <h1>
            Financial Records
          </h1>

          <p className="muted">
            Your complete transaction history
          </p>

        </div>


        <Link
          href="/"
          className="icon-button"
        >
          ←
        </Link>

      </header>


      <section className="wallet-summary">

        <div className="wallet-summary-item">

          <span>
            Total Credits
          </span>

          <strong>

            GHS{" "}

            {Number(
              totals.credits || 0
            ).toLocaleString("en-GH")}

          </strong>

        </div>


        <div className="wallet-summary-item">

          <span>
            Total Debits
          </span>

          <strong>

            GHS{" "}

            {Number(
              totals.debits || 0
            ).toLocaleString("en-GH")}

          </strong>

        </div>

      </section>


      <section className="record-filters">

        {filters.map(
          ([label, value]) => (

            <button

              key={value}

              type="button"

              onClick={() =>
                setActiveFilter(value)
              }

              className={
                `record-filter ${
                  activeFilter === value
                    ? "active"
                    : ""
                }`
              }
            >

              {label}

            </button>

          )
        )}

      </section>


      <section className="records-card">

        <div className="records-header">

          <h2>
            Transactions
          </h2>


          <span className="records-count">

            {filteredRecords.length}

          </span>

        </div>


        {loading ? (

          <div className="empty-document">
            Loading records...
          </div>

        ) : error ? (

          <div className="empty-document">
            {error}
          </div>

        ) : filteredRecords.length === 0 ? (

          <div className="empty-document">
            No records found.
          </div>

        ) : (

          <div className="transaction-list">

            {filteredRecords.map(
              (record, index) => {

                const category =
                  getCategory(record);


                const withdrawalStatus =
                  category === "withdrawal"
                    ? getWithdrawalStatus(record)
                    : null;


                const credit =
                  isCredit(record);


                const amount =
                  category === "withdrawal"

                    ? (

                      record?.gross_amount ||

                      Math.abs(
                        Number(
                          record?.amount || 0
                        )
                      )

                    )

                    : record?.amount;


                return (

                  <article

                    className="transaction-item"

                    key={
                      record?.withdrawal_order_id ||

                      record?.id ||

                      `${index}-${record?.created_at}`
                    }

                  >

                    <div className="transaction-main">

                      <div className="transaction-title">

                        {getTitle(record)}

                      </div>


                      <div className="transaction-meta">

                        <span>

                          {formatDate(
                            record?.created_at
                          )}

                        </span>

                      </div>


                      <div className="transaction-tags">

                        <span
                          className={
                            `transaction-category ${category}`
                          }
                        >

                          {category}

                        </span>


                        {withdrawalStatus && (

                          <span
                            className={
                              `withdrawal-status ${withdrawalStatus.key}`
                            }
                          >

                            {withdrawalStatus.label}

                          </span>

                        )}

                      </div>


                      {category === "withdrawal" &&

                        withdrawalStatus?.key === "rejected" &&

                        record?.rejection_reason && (

                          <p className="rejection-reason">

                            Reason:{" "}

                            {record.rejection_reason}

                          </p>

                        )}

                    </div>


                    <div
                      className={
                        `transaction-amount ${
                          credit
                            ? "credit"
                            : "debit"
                        }`
                      }
                    >

                      {credit ? "+" : "−"}

                      {" "}GHS{" "}

                      {formatAmount(amount)}

                    </div>

                  </article>

                );

              }
            )}

          </div>

        )}

      </section>


      <style jsx>{`

        .wallet-summary {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 14px;
          margin: 20px 0;
        }

        .wallet-summary-item,
        .records-card {
          background: white;
          border-radius: 22px;
          box-shadow:
            0 10px 30px
            rgba(20,40,80,.08);
        }

        .wallet-summary-item {
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .wallet-summary-item span {
          color: #7b8797;
          font-size: 13px;
        }

        .wallet-summary-item strong {
          color: #243044;
          font-size: 19px;
        }

        .record-filters {
          display: flex;
          gap: 8px;
          overflow-x: auto;
          padding-bottom: 12px;
        }

        .record-filter {
          border: 1px solid #e4e8ee;
          background: white;
          padding: 10px 16px;
          border-radius: 999px;
          white-space: nowrap;
          color: #687386;
        }

        .record-filter.active {
          background: #243b64;
          color: white;
        }

        .records-card {
          padding: 20px;
        }

        .records-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 15px;
        }

        .records-header h2 {
          margin: 0;
        }

        .records-count {
          background: #eef3fb;
          border-radius: 999px;
          padding: 5px 10px;
        }

        .transaction-item {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          padding: 16px 0;
          border-bottom:
            1px solid #edf0f4;
        }

        .transaction-item:last-child {
          border-bottom: none;
        }

        .transaction-main {
          flex: 1;
          min-width: 0;
        }

        .transaction-title {
          font-weight: 700;
          color: #293448;
        }

        .transaction-meta {
          margin-top: 5px;
          color: #8792a5;
          font-size: 12px;
        }

        .transaction-tags {
          display: flex;
          gap: 7px;
          margin-top: 8px;
          flex-wrap: wrap;
        }

        .transaction-category,
        .withdrawal-status {
          display: inline-flex;
          padding: 4px 9px;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 700;
          text-transform: capitalize;
        }

        .transaction-category.revenue {
          background: #e8f7ee;
          color: #21834a;
        }

        .transaction-category.expenditure {
          background: #fff0e9;
          color: #c45b2a;
        }

        .transaction-category.deposit {
          background: #eaf3ff;
          color: #3975b9;
        }

        .transaction-category.withdrawal {
          background: #f1efff;
          color: #6656bd;
        }

        .withdrawal-status.pending {
          background: #fff4d8;
          color: #9b6a00;
        }

        .withdrawal-status.successful {
          background: #e8f7ee;
          color: #21834a;
        }

        .withdrawal-status.rejected {
          background: #fff0f0;
          color: #c23f3f;
        }

        .transaction-amount {
          font-weight: 800;
          white-space: nowrap;
        }

        .transaction-amount.credit {
          color: #208449;
        }

        .transaction-amount.debit {
          color: #c34c3d;
        }

        .rejection-reason {
          margin: 8px 0 0;
          color: #c24a4a;
          font-size: 12px;
        }

        .empty-document {
          min-height: 220px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #7d8797;
          text-align: center;
        }

      `}</style>

    </main>

  );

}
