import { getDb } from "@/lib/db.js";
import {
  verifySessionToken,
  ADMIN_COOKIE_NAME
} from "@/lib/session.js";


function admin(request) {
  const cookies =
    request.headers.get("cookie") || "";

  const match = cookies.match(
    new RegExp(
      `${ADMIN_COOKIE_NAME}=([^;]+)`
    )
  );

  const session = match
    ? verifySessionToken(match[1])
    : null;

  return session &&
    session.role === "admin"
    ? session
    : null;
}


function unauthorized() {
  return Response.json(
    {
      error: "Unauthorized"
    },
    {
      status: 401
    }
  );
}


export async function GET(request) {
  if (!admin(request)) {
    return unauthorized();
  }

  try {
    const { rows } =
      await getDb().query(`
        SELECT
          id,
          name,
          location,
          description,
          image_url,
          active,
          display_order
        FROM branches
        ORDER BY
          display_order ASC,
          id ASC
      `);

    return Response.json({
      branches: rows
    });

  } catch (error) {

    return Response.json(
      {
        error: "Unable to load branches."
      },
      {
        status: 500
      }
    );
  }
}


export async function POST(request) {
  if (!admin(request)) {
    return unauthorized();
  }

  try {
    const body =
      await request.json();

    const name = String(
      body.name || ""
    ).trim();

    if (!name) {
      return Response.json(
        {
          error:
            "Branch name is required."
        },
        {
          status: 400
        }
      );
    }

    const location = String(
      body.location || ""
    ).trim() || null;

    const description = String(
      body.description || ""
    ).trim() || null;

    const imageUrl = String(
      body.imageUrl || ""
    ).trim() || null;

    const displayOrder =
      Math.trunc(
        Number(
          body.displayOrder || 0
        )
      );

    const active =
      body.active !== false;

    const { rows } =
      await getDb().query(
        `
          INSERT INTO branches(
            name,
            location,
            description,
            image_url,
            active,
            display_order
          )
          VALUES(
            $1,
            $2,
            $3,
            $4,
            $5,
            $6
          )
          RETURNING *
        `,
        [
          name,
          location,
          description,
          imageUrl,
          active,
          displayOrder
        ]
      );

    return Response.json(
      {
        branch: rows[0]
      },
      {
        status: 201
      }
    );

  } catch (error) {

    return Response.json(
      {
        error: "Unable to save branch."
      },
      {
        status: 400
      }
    );
  }
}


export async function PUT(request) {
  if (!admin(request)) {
    return unauthorized();
  }

  try {
    const body =
      await request.json();

    const id = String(
      body.id || ""
    ).trim();

    if (!id) {
      return Response.json(
        {
          error:
            "Branch ID is required."
        },
        {
          status: 400
        }
      );
    }

    const name = String(
      body.name || ""
    ).trim();

    if (!name) {
      return Response.json(
        {
          error:
            "Branch name is required."
        },
        {
          status: 400
        }
      );
    }

    const location = String(
      body.location || ""
    ).trim() || null;

    const description = String(
      body.description || ""
    ).trim() || null;

    const imageUrl = String(
      body.imageUrl || ""
    ).trim() || null;

    const displayOrder =
      Math.trunc(
        Number(
          body.displayOrder || 0
        )
      );

    const active =
      body.active !== false;

    const { rows } =
      await getDb().query(
        `
          UPDATE branches
          SET
            name = $1,
            location = $2,
            description = $3,
            image_url = $4,
            active = $5,
            display_order = $6
          WHERE id = $7
          RETURNING *
        `,
        [
          name,
          location,
          description,
          imageUrl,
          active,
          displayOrder,
          id
        ]
      );

    if (!rows.length) {
      return Response.json(
        {
          error:
            "Branch not found."
        },
        {
          status: 404
        }
      );
    }

    return Response.json({
      branch: rows[0]
    });

  } catch (error) {

    return Response.json(
      {
        error: "Unable to update branch."
      },
      {
        status: 400
      }
    );
  }
}


export async function DELETE(request) {
  if (!admin(request)) {
    return unauthorized();
  }

  try {
    const { searchParams } =
      new URL(request.url);

    const id = String(
      searchParams.get("id") || ""
    ).trim();

    if (!id) {
      return Response.json(
        {
          error:
            "Branch ID is required."
        },
        {
          status: 400
        }
      );
    }

    const { rows } =
      await getDb().query(
        `
          DELETE FROM branches
          WHERE id = $1
          RETURNING *
        `,
        [id]
      );

    if (!rows.length) {
      return Response.json(
        {
          error:
            "Branch not found."
        },
        {
          status: 404
        }
      );
    }

    return Response.json({
      success: true,
      deletedBranch: rows[0]
    });

  } catch (error) {

    return Response.json(
      {
        error: "Unable to delete branch."
      },
      {
        status: 500
      }
    );
  }
}
