import { Document, NodeIO } from "@gltf-transform/core";
import { EXTMeshoptCompression, KHRMeshQuantization } from "@gltf-transform/extensions";
import { dedup, prune, quantize, reorder, weld } from "@gltf-transform/functions";
import { MeshoptEncoder } from "meshoptimizer";
import type { MeshBuilder } from "./mesh";

/**
 * Writes meshes to a meshopt-compressed GLB. Every mesh becomes one node with
 * POSITION, COLOR_0 and, where present, the custom `_WALL` attribute.
 * Materials are assigned by the game at load time, keyed by node name.
 */
export async function writeGlb(file: string, meshes: MeshBuilder[]): Promise<number> {
  const document = new Document();
  document.createBuffer();
  const scene = document.createScene("place");

  for (const builder of meshes) {
    if (builder.triangleCount === 0) continue;
    const primitive = document
      .createPrimitive()
      .setAttribute(
        "POSITION",
        document.createAccessor().setType("VEC3").setArray(new Float32Array(builder.positions)),
      )
      .setAttribute(
        "COLOR_0",
        document
          .createAccessor()
          .setType("VEC3")
          .setNormalized(true)
          .setArray(new Uint8Array(builder.colors.map((value) => Math.round(value * 255)))),
      );
    if (builder.withExtras) {
      primitive.setAttribute(
        "_WALL",
        document.createAccessor().setType("VEC4").setArray(new Float32Array(builder.extras)),
      );
    }
    const mesh = document.createMesh(builder.name).addPrimitive(primitive);
    scene.addChild(document.createNode(builder.name).setMesh(mesh));
  }

  await MeshoptEncoder.ready;
  await document.transform(
    weld(),
    dedup(),
    reorder({ encoder: MeshoptEncoder, target: "size" }),
    // 16 bits keep the few-centimeter ground layer offsets intact across a ~450 m scene.
    quantize({ pattern: /^(POSITION|COLOR_0)$/, quantizePosition: 16, quantizeColor: 8 }),
    prune(),
  );
  document.createExtension(KHRMeshQuantization).setRequired(true);
  document
    .createExtension(EXTMeshoptCompression)
    .setRequired(true)
    .setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.QUANTIZE });

  const io = new NodeIO()
    .registerExtensions([EXTMeshoptCompression, KHRMeshQuantization])
    .registerDependencies({ "meshopt.encoder": MeshoptEncoder });
  const bytes = await io.writeBinary(document);
  const { writeFileSync } = await import("node:fs");
  writeFileSync(file, bytes);
  return bytes.byteLength;
}
