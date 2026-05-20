-- CreateTable
CREATE TABLE "SystemSettings" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'default',
    "gtmId" TEXT,
    "openingTime" TEXT NOT NULL DEFAULT '09:00',
    "closingTime" TEXT NOT NULL DEFAULT '19:00',
    "adminPassword" TEXT NOT NULL DEFAULT 'admin123',
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Barber" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "googleAccessToken" TEXT,
    "googleRefreshToken" TEXT,
    "googleTokenExpiry" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Service" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "price" REAL NOT NULL,
    "duration" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Booking" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clientName" TEXT NOT NULL,
    "clientEmail" TEXT NOT NULL,
    "clientPhone" TEXT NOT NULL,
    "dateTime" DATETIME NOT NULL,
    "serviceId" TEXT NOT NULL,
    "barberId" TEXT NOT NULL,
    "googleEventId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Booking_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Booking_barberId_fkey" FOREIGN KEY ("barberId") REFERENCES "Barber" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "_BarberServices" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,
    CONSTRAINT "_BarberServices_A_fkey" FOREIGN KEY ("A") REFERENCES "Barber" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_BarberServices_B_fkey" FOREIGN KEY ("B") REFERENCES "Service" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Barber_email_key" ON "Barber"("email");

-- CreateIndex
CREATE UNIQUE INDEX "_BarberServices_AB_unique" ON "_BarberServices"("A", "B");

-- CreateIndex
CREATE INDEX "_BarberServices_B_index" ON "_BarberServices"("B");
