import os
from PIL import Image

class GifMaster:
    @staticmethod
    def descomponer_gif(ruta_input, carpeta_destino):
        """Extrae cada fotograma de un GIF y lo guarda como PNG."""
        if not os.path.exists(carpeta_destino):
            os.makedirs(carpeta_destino)
            
        with Image.open(ruta_input) as img:
            for i in range(getattr(img, 'n_frames', 1)):
                img.seek(i)
                # Convertimos a RGBA para preservar transparencias si existen
                frame = img.convert("RGBA")
                nombre_archivo = f"frame_{i:03d}.png"
                frame.save(os.path.join(carpeta_destino, nombre_archivo))
                print(f"Guardado: {nombre_archivo}")

    @staticmethod
    def crear_gif_personalizado(lista_imagenes, ruta_salida, duracion=100, loop=0, target_size=None):
        """
        Crea un GIF a partir de una lista de rutas de imágenes.
        - duracion: tiempo entre cuadros en milisegundos (ej: 100 = 0.1s).
        - loop: 0 significa infinito, cualquier otro número es la cantidad de repeticiones.
        - target_size: tupla (ancho, alto) para redimensionar cada cuadro.
        """
        frames = []
        for ruta in lista_imagenes:
            try:
                nueva_img = Image.open(ruta).convert("RGBA")
                if target_size:
                    nueva_img = nueva_img.resize(target_size, Image.Resampling.LANCZOS)
                frames.append(nueva_img)
            except Exception as e:
                print(f"Error cargando imagen {ruta}: {e}")

        if frames:
            # El primer frame define el archivo, los demás se añaden como 'append_images'
            frames[0].save(
                ruta_salida,
                save_all=True,
                append_images=frames[1:],
                optimize=True,
                duration=duracion,
                loop=loop,
                disposal=2 # Restore to background color. Helps with transparency stacking issues
            )
            print(f"¡GIF creado con éxito en: {ruta_salida}!")
            return True
        return False
