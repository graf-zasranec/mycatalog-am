"""Regression: transparent padding cannot make a tiny product high resolution."""
import importlib.util
import tempfile
import unittest
from pathlib import Path
from PIL import Image, ImageDraw

spec = importlib.util.spec_from_file_location('imgcheck', Path(__file__).with_name('imgcheck.py'))
imgcheck = importlib.util.module_from_spec(spec)
spec.loader.exec_module(imgcheck)


class NativeProductResolution(unittest.TestCase):
    def image(self, directory, canvas, bounds, name):
        path = Path(directory) / name
        image = Image.new('RGBA', canvas, (0, 0, 0, 0))
        ImageDraw.Draw(image).rectangle(bounds, fill=(80, 90, 100, 255))
        image.save(path)
        return path

    def test_large_canvas_does_not_hide_small_product(self):
        with tempfile.TemporaryDirectory() as directory:
            path = self.image(directory, (1200, 1200), (450, 400, 749, 799), 'small.png')
            self.assertTrue(any('visible product' in issue for issue in imgcheck.check(path)),
                            '400px product inside a 1200px canvas must remain a native-size finding')

    def test_real_native_detail_meets_floor(self):
        with tempfile.TemporaryDirectory() as directory:
            path = self.image(directory, (900, 900), (100, 200, 799, 699), 'large.png')
            self.assertFalse(any('visible product' in issue for issue in imgcheck.check(path)))

    def test_exact_six_hundred_is_accepted(self):
        with tempfile.TemporaryDirectory() as directory:
            path = self.image(directory, (700, 700), (50, 100, 649, 599), 'floor.png')
            self.assertFalse(any('visible product' in issue for issue in imgcheck.check(path)))


if __name__ == '__main__':
    unittest.main()
