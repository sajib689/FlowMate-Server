const { ObjectId } = require("mongodb");
const usersCollection = require("../models/userModel");
const { connectDB, db } = require("../utils/db");
const teamsCollection = db.collection("teams");
const Users = require("../models/userModel");
const bcrypt = require("bcryptjs"); // Add this line
const jwt = require("jsonwebtoken");

exports.createUser = async (req, res) => {
  try {
    const { name, email, password, role, status, photo, teamName } = req.body;

    // Check if the user already exists
    const existingUser = await usersCollection.findOne({ email });

    if (existingUser) {
      return res.status(409).json({ message: "User already exists" }); // 409 Conflict
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10); // Correct the spelling of bcrypt

    // Create the new user
    const result = await usersCollection.insertOne({
      name,
      email,
      password: hashedPassword,
      role,
      status,
      photo,
      teamName,
    });

    // Create a token using the new user's ID from the result
    const token = jwt.sign(
      { id: result._id, email: result.email }, // Use result.insertedId to get the new user's ID
      process.env.JWT_SECRET,
      {
        expiresIn: "1h", // Token expiration time
      }
    );

    result.token = token;
    result.password = null;

    console.log("Token created:", token);

    // Send back the token and result
    res
      .status(201)
      .json({ token, user: { name, email, role, status, photo, teamName } }); // Send user info too
  } catch (error) {
    console.error("Error creating user:", error);
    res.status(500).send({ message: "Failed to create user" });
  }
};
exports.getUsersByTeam = async (req, res) => {
  try {
    // Extract team name from request parameters
    const { teamName } = req.params; // Assuming team name is passed as a URL parameter

    // Fetch team details based on the team name
    const team = await teamsCollection.findOne({ teamName: teamName });

    // Check if team exists
    if (!team) {
      return res.status(404).send({ message: "Team not found." });
    }

    // Get the teamMembers IDs
    const { teamMembers } = team;
    // console.log(teamMembers);

    // Filter for active users in the specified team members
    const filter = {
      _id: { $in: teamMembers.map((id) => new ObjectId(id)) },
      status: "active",
    };
    // console.log(filter);
    // Adjust the filter to match the user schema
    const result = await usersCollection.find(filter).toArray();

    // Check if any users are found
    if (result.length === 0) {
      return res
        .status(404)
        .send({ message: "No active users found for this team." });
    }

    res.send(result);
  } catch (error) {
    console.error("Error fetching users by team:", error);
    res.status(500).send({ message: "Failed to fetch users" });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await usersCollection.findOne({ email });

    if (!user) {
      return res.status(401).send({ message: "User not found" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).send({ message: "Invalid email or password" });
    }

    const token = jwt.sign(
      { id: user._id, email: user.email },
      process.env.JWT_SECRET,
      {
        expiresIn: "1h",
      }
    );
    user.token = token;
    user.password = null;

    const options = {
      expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      httpOnly: true,
    };

    res.status(200).cookie("token", token, options).json({
      message: "User created successfully",
      user,
      token,
    });
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).send({ message: "Failed to fetch users" });
  }
};

exports.getUsers = async (req, res) => {
  try {
    const filter = { status: "active" };
    const result = await usersCollection.find(filter).toArray();
    res.send(result);
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).send({ message: "Failed to fetch users" });
  }
};
//block a user
exports.toggleUserBlockStatus = async (req, res) => {
  try {
    const { email } = req.params;
    const { status } = req.body; // Expect "blocked" or "active" in the request body

    if (!email) {
      return res.status(400).send({ message: "User email is required" });
    }
    if (!status || (status !== "blocked" && status !== "active")) {
      return res
        .status(400)
        .send({ message: "Valid status ('blocked' or 'active') is required" });
    }

    const updatedUser = await Users.findOneAndUpdate(
      { email },
      { $set: { status } },
      { new: true }
    );

    if (!updatedUser) {
      return res.status(404).send({ message: "User not found" });
    }

    res
      .status(200)
      .send({ message: `User ${status} successfully`, user: updatedUser });
  } catch (error) {
    console.error("Error updating user status:", error);
    res.status(500).send({ message: "Failed to update user status" });
  }
};

exports.updateUserProfileByEmail = async (req, res) => {
  try {
    const { email, name, photo } = req.body;

    if (!email || !name || !photo) {
      return res.status(400).send({ message: "Missing required fields" });
    }

    // Use $set operator to update only the specific fields
    const updatedUser = await Users.findOneAndUpdate(
      { email: email }, // Find the user by email
      { $set: { name: name, photo: photo } }, // Use $set to update name and photo
      { new: true } // Return the updated user document
    );

    if (!updatedUser) {
      return res.status(404).send({ message: "User not found" });
    }

    res
      .status(200)
      .send({ message: "Profile updated successfully", user: updatedUser });
  } catch (error) {
    console.error("Error updating user profile:", error);
    res.status(500).send({ message: "Failed to update user profile" });
  }
};

exports.updateFileCountByEmail = async (req, res) => {
  try {
    const { email } = req.params;

    // Check if email is provided
    if (!email) {
      return res.status(400).send({ message: "Email is required" });
    }

    // Find the user by email and increment fileCount by 1
    const updatedUser = await Users.findOneAndUpdate(
      { email: email },
      { $inc: { fileCount: 1 } }, // Increment fileCount by 1
      { new: true }
    );

    if (!updatedUser) {
      return res.status(404).send({ message: "User not found" });
    }

    res
      .status(200)
      .send({ message: "File count updated successfully", user: updatedUser });
  } catch (error) {
    console.error("Error updating file count:", error);
    res.status(500).send({ message: "Failed to update file count" });
  }
};
exports.getFileCountByEmail = async (req, res) => {
  try {
    const { email } = req.params;
    // console.log(email);

    // Check if email is provided
    if (!email) {
      return res.status(400).send({ message: "Email is required" });
    }

    const user = await usersCollection.findOne({ email: email });

    if (!user) {
      return res.status(404).send({ message: "User not found" });
    }

    const fileCount = user.fileCount || 0;

    res
      .status(200)
      .send({ message: "File count fetched successfully", fileCount });
  } catch (error) {
    console.error("Error fetching file count:", error);
    res.status(500).send({ message: "Failed to fetch file count" });
  }
};
