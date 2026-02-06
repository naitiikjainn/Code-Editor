#!/bin/sh
# CSES Judge Sandbox Entrypoint
# Usage: /entrypoint.sh <language> <time_limit_seconds>
# Expects: /workspace/solution.{ext} and /workspace/input.txt
# Outputs: /output/stdout.txt, /output/stderr.txt, /output/exitcode.txt

LANG="$1"
TIME_LIMIT="$2"

# Ensure output directory exists
mkdir -p /output

case "$LANG" in
  cpp)
    # Compile
    g++ -O2 -std=c++17 -o /tmp/sol /workspace/solution.cpp 2>/output/stderr.txt
    if [ $? -ne 0 ]; then
      echo "CE" > /output/exitcode.txt
      exit 0
    fi
    # Run with time limit
    timeout "${TIME_LIMIT}s" /tmp/sol < /workspace/input.txt > /output/stdout.txt 2>>/output/stderr.txt
    EXIT_CODE=$?
    ;;
  python)
    timeout "${TIME_LIMIT}s" python3 /workspace/solution.py < /workspace/input.txt > /output/stdout.txt 2>/output/stderr.txt
    EXIT_CODE=$?
    ;;
  java)
    # Copy and compile
    cp /workspace/solution.java /tmp/Main.java 2>/dev/null || cp /workspace/solution.java /tmp/Solution.java 2>/dev/null
    javac /tmp/*.java 2>/output/stderr.txt
    if [ $? -ne 0 ]; then
      echo "CE" > /output/exitcode.txt
      exit 0
    fi
    # Detect main class
    MAIN_CLASS="Main"
    if [ ! -f /tmp/Main.class ]; then
      MAIN_CLASS="Solution"
    fi
    timeout "${TIME_LIMIT}s" java -cp /tmp "$MAIN_CLASS" < /workspace/input.txt > /output/stdout.txt 2>>/output/stderr.txt
    EXIT_CODE=$?
    ;;
  javascript)
    timeout "${TIME_LIMIT}s" node /workspace/solution.js < /workspace/input.txt > /output/stdout.txt 2>/output/stderr.txt
    EXIT_CODE=$?
    ;;
  *)
    echo "Unsupported language: $LANG" > /output/stderr.txt
    echo "RE" > /output/exitcode.txt
    exit 0
    ;;
esac

# Determine exit code meaning
if [ $EXIT_CODE -eq 124 ]; then
  echo "TLE" > /output/exitcode.txt
elif [ $EXIT_CODE -eq 137 ]; then
  echo "MLE" > /output/exitcode.txt
elif [ $EXIT_CODE -ne 0 ]; then
  echo "RE" > /output/exitcode.txt
else
  echo "OK" > /output/exitcode.txt
fi
