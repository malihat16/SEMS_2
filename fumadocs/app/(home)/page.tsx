import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="flex flex-col justify-center text-center flex-1">
      <h1 className="text-2xl font-bold mb-4">
        Student Experience Management System Documentation
      </h1>
      <p>
        You can open{" "}
        <Link
          href="/docs/manuals/getting-started"
          className="font-medium underline"
        >
          this
        </Link>{" "}
        to browse the documentation.
      </p>
    </div>
  );
}
