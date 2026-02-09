#!/usr/bin/env python3
"""
Build Lambda deployment packages for the orchestrator module.
This script is designed to run in CI/CD pipelines (cross-platform).
"""

import os
import shutil
import tempfile
import zipfile
from pathlib import Path


def build_common_layer(module_dir: Path, output_dir: Path) -> None:
    """Build the common Lambda layer."""
    print("Building common layer...")
    
    common_dir = module_dir / "lambda" / "common"
    output_zip = output_dir / "layers" / "common.zip"
    output_zip.parent.mkdir(parents=True, exist_ok=True)
    
    # Create temp directory with python/ subdirectory (required for Lambda layers)
    with tempfile.TemporaryDirectory() as temp_dir:
        python_dir = Path(temp_dir) / "python"
        python_dir.mkdir()
        
        # Copy Python files
        for py_file in common_dir.glob("*.py"):
            shutil.copy(py_file, python_dir / py_file.name)
            print(f"  Added: {py_file.name}")
        
        # Create zip
        with zipfile.ZipFile(output_zip, 'w', zipfile.ZIP_DEFLATED) as zf:
            for file_path in python_dir.rglob("*"):
                if file_path.is_file():
                    arcname = file_path.relative_to(temp_dir)
                    zf.write(file_path, arcname)
    
    print(f"  Created: {output_zip}")


def build_lambda_package(func_name: str, module_dir: Path, output_dir: Path) -> None:
    """Build a single Lambda function package."""
    print(f"Building {func_name}...")
    
    func_dir = module_dir / "lambda" / func_name
    output_zip = output_dir / "packages" / f"{func_name}.zip"
    output_zip.parent.mkdir(parents=True, exist_ok=True)
    
    if not func_dir.exists() or not (func_dir / "index.py").exists():
        print(f"  Warning: {func_dir}/index.py not found, skipping...")
        return
    
    with zipfile.ZipFile(output_zip, 'w', zipfile.ZIP_DEFLATED) as zf:
        for py_file in func_dir.glob("*.py"):
            zf.write(py_file, py_file.name)
            print(f"  Added: {py_file.name}")
    
    print(f"  Created: {output_zip}")


def main():
    # Determine paths
    script_dir = Path(__file__).parent.resolve()
    repo_root = script_dir.parent
    module_dir = repo_root / "modules" / "orchestrator"
    output_dir = module_dir / "lambda"
    
    print(f"Building Lambda packages...")
    print(f"Module directory: {module_dir}")
    print()
    
    # Build common layer
    build_common_layer(module_dir, output_dir)
    print()
    
    # Lambda functions to build
    functions = [
        # AttackBox session management
        "create-session",
        "get-session-status", 
        "terminate-session",
        "pool-manager",
        "get-usage",
        "usage-history",
        "admin-sessions",
        "session-heartbeat",
        # WebSocket functions
        "websocket-connect",
        "websocket-disconnect",
        "websocket-default",
        "websocket-push",
        # Lab management
        "create-lab-session",
        "get-lab-status",
        "terminate-lab-session",
        "list-lab-templates",
    ]
    
    # Build each function
    for func_name in functions:
        build_lambda_package(func_name, module_dir, output_dir)
    
    print()
    print("Build complete!")
    
    # List created files
    print("\nPackages created:")
    packages_dir = output_dir / "packages"
    layers_dir = output_dir / "layers"
    
    if layers_dir.exists():
        for f in layers_dir.glob("*.zip"):
            print(f"  {f.relative_to(repo_root)}")
    
    if packages_dir.exists():
        for f in packages_dir.glob("*.zip"):
            print(f"  {f.relative_to(repo_root)}")


if __name__ == "__main__":
    main()
